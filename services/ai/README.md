# Trizpyy AI service (FastAPI)

Optional Python service the Go backend calls over HTTP (`AI_SERVICE_URL`). When it is off, slow or
returns something invalid, Go falls back to its own rules — nothing in the app breaks.

| Endpoint | What it does |
|---|---|
| `GET /health` | Status, semantic model state (`loading` / `ready` / `unavailable`), vector store |
| `POST /optimize/day` | Day route + times with Google OR-Tools (routing with time windows); reports conflicts when no plan fits |
| `POST /similar` | Activities similar to one activity (sentence-transformers `all-MiniLM-L6-v2`) |
| `POST /search` | Search by feeling ("quiet places with great food") |
| `GET /similarity-matrix` | Pairwise similarity inside each destination (Go loads it for swap ranking) |
| `POST /risk/delay` | **Demo** delay-risk model (logistic regression on synthetic history — not validated on real delays) |
| `POST /vendors/reliability` | Chance a vendor fails the next request, with a 90% interval (Beta-Binomial). Go still owns the trust score |

Embeddings are stored in Postgres with pgvector (`ai_activity_embeddings`) when `DATABASE_URL` is set and the
`vector` extension is available (set `PGVECTOR=0` to keep them in memory).

```bash
cd services/ai
py -3.14 -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --port 8090
.venv/Scripts/python -m pytest -q
```

Docker: `docker compose --profile ai up --build` (built from the repository root).
