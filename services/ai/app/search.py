"""Semantic similarity and search-by-feeling over the real activity catalog.

Embeddings come from sentence-transformers (all-MiniLM-L6-v2, 384 dims) built from each
activity's title, description, tags and effort. They are stored in Postgres with pgvector when
DATABASE_URL is set and the extension is available, otherwise kept in memory. If the model
can't load, the endpoints answer 503 and the Go backend falls back to its keyword rules; no
fake vectors are ever produced.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
from pathlib import Path

import numpy as np

log = logging.getLogger("ai.search")

MODEL_NAME = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
DEFAULT_CATALOG = Path(__file__).resolve().parents[3] / "backend" / "internal" / "seed" / "data" / "catalog.json"


def activity_text(a: dict) -> str:
    where = "Outdoor" if a.get("outdoor") else "Indoor"
    return (f"{a['title']}. {a.get('description', '')} Tags: {', '.join(a.get('interests', []))}. "
            f"{where}, effort {a.get('energy', 1)} of 5, walking {a.get('walking', 'low')}.")


class Index:
    def __init__(self, catalog_path: str | None = None, database_url: str | None = None, use_pgvector: bool = True):
        self.catalog_path = Path(catalog_path or os.getenv("CATALOG_PATH") or DEFAULT_CATALOG)
        self.database_url = database_url if database_url is not None else os.getenv("DATABASE_URL", "")
        self.use_pgvector = use_pgvector and bool(self.database_url) and os.getenv("PGVECTOR", "1") != "0"
        self.status = "loading"
        self.error = ""
        self.store = "memory"
        self.activities: list[dict] = []
        self.by_id: dict[str, int] = {}
        self.vectors: np.ndarray | None = None
        self.model = None
        self._lock = threading.Lock()

    # ── lifecycle ──
    def load(self) -> None:
        try:
            data = json.loads(self.catalog_path.read_text(encoding="utf-8"))
            self.activities = data["activities"]
            self.by_id = {a["id"]: i for i, a in enumerate(self.activities)}
            from sentence_transformers import SentenceTransformer

            self.model = SentenceTransformer(MODEL_NAME, device="cpu")
            texts = [activity_text(a) for a in self.activities]
            vecs = self.model.encode(texts, normalize_embeddings=True, batch_size=64, show_progress_bar=False)
            self.vectors = np.asarray(vecs, dtype=np.float32)
            if self.use_pgvector:
                try:
                    self._sync_pgvector(texts)
                    self.store = "pgvector"
                except Exception as e:  # the service still works from memory
                    log.warning("pgvector unavailable, using memory: %s", e)
                    self.store, self.error = "memory", f"pgvector: {e}"
            self.status = "ready"
        except Exception as e:
            log.exception("semantic index failed to load")
            self.status, self.error = "unavailable", str(e)

    def _sync_pgvector(self, texts: list[str]) -> None:
        import psycopg
        from pgvector.psycopg import register_vector

        with psycopg.connect(self.database_url, autocommit=True, connect_timeout=10) as conn:
            conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            register_vector(conn)
            conn.execute("""CREATE TABLE IF NOT EXISTS ai_activity_embeddings (
                activity_id text PRIMARY KEY, destination_id text NOT NULL, model text NOT NULL,
                text_hash text NOT NULL, embedding vector(384) NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())""")
            have = dict(conn.execute("SELECT activity_id, text_hash FROM ai_activity_embeddings WHERE model = %s", (MODEL_NAME,)).fetchall())
            with conn.cursor() as cur:
                for a, text, vec in zip(self.activities, texts, self.vectors):
                    h = hashlib.sha256(text.encode()).hexdigest()[:16]
                    if have.get(a["id"]) == h:
                        continue
                    cur.execute("""INSERT INTO ai_activity_embeddings (activity_id, destination_id, model, text_hash, embedding)
                        VALUES (%s,%s,%s,%s,%s) ON CONFLICT (activity_id) DO UPDATE SET destination_id=EXCLUDED.destination_id,
                        model=EXCLUDED.model, text_hash=EXCLUDED.text_hash, embedding=EXCLUDED.embedding, updated_at=now()""",
                                (a["id"], a["destinationId"], MODEL_NAME, h, vec))

    def ready(self) -> bool:
        return self.status == "ready"

    # ── queries ──
    def _rank(self, query_vec: np.ndarray, pool: list[int], k: int) -> list[tuple[int, float]]:
        if self.store == "pgvector":
            try:
                return self._rank_pg(query_vec, pool, k)
            except Exception as e:
                log.warning("pgvector query failed, using memory: %s", e)
        scores = self.vectors[pool] @ query_vec
        top = np.argsort(-scores)[:k]
        return [(pool[i], float(scores[i])) for i in top]

    def _rank_pg(self, query_vec: np.ndarray, pool: list[int], k: int) -> list[tuple[int, float]]:
        import psycopg
        from pgvector.psycopg import register_vector

        ids = [self.activities[i]["id"] for i in pool]
        with psycopg.connect(self.database_url, connect_timeout=5) as conn:
            register_vector(conn)
            rows = conn.execute("""SELECT activity_id, 1 - (embedding <=> %s) FROM ai_activity_embeddings
                WHERE model = %s AND activity_id = ANY(%s) ORDER BY embedding <=> %s LIMIT %s""",
                                (query_vec, MODEL_NAME, ids, query_vec, k)).fetchall()
        return [(self.by_id[r[0]], float(r[1])) for r in rows if r[0] in self.by_id]

    def _match(self, i: int, score: float) -> dict:
        a = self.activities[i]
        return {"id": a["id"], "title": a["title"], "destination_id": a["destinationId"], "score": round(score, 4), "interests": a.get("interests", [])}

    def similar(self, activity_id: str, k: int, same_destination: bool, exclude: list[str]) -> list[dict]:
        if activity_id not in self.by_id:
            raise KeyError(activity_id)
        src = self.by_id[activity_id]
        dest = self.activities[src]["destinationId"]
        skip = set(exclude) | {activity_id}
        pool = [i for i, a in enumerate(self.activities) if a["id"] not in skip and (not same_destination or a["destinationId"] == dest)]
        if not pool:
            return []
        return [self._match(i, s) for i, s in self._rank(self.vectors[src], pool, k)]

    def search(self, query: str, destination_id: str | None, k: int) -> list[dict]:
        pool = [i for i, a in enumerate(self.activities) if not destination_id or a["destinationId"] == destination_id]
        if not pool:
            return []
        with self._lock:
            q = self.model.encode([query], normalize_embeddings=True, show_progress_bar=False)[0].astype(np.float32)
        return [self._match(i, s) for i, s in self._rank(q, pool, k)]

    def matrix(self, destination_id: str | None) -> dict[str, dict[str, float]]:
        """Cosine similarity between every pair of activities in the same destination (for Go's swap ranking)."""
        out: dict[str, dict[str, float]] = {}
        groups: dict[str, list[int]] = {}
        for i, a in enumerate(self.activities):
            if not destination_id or a["destinationId"] == destination_id:
                groups.setdefault(a["destinationId"], []).append(i)
        for idx in groups.values():
            sims = self.vectors[idx] @ self.vectors[idx].T
            for x, i in enumerate(idx):
                out[self.activities[i]["id"]] = {self.activities[j]["id"]: round(float(sims[x, y]), 4) for y, j in enumerate(idx) if j != i}
        return out
