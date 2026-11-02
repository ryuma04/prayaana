"""Aligns a Nugen base model to Trizpyy's travel domain and deploys it.

Base model -> Nugen alignment on the Trizpyy corpus -> domain-specific model -> deployed for the app.

Steps (resumable; progress is kept in state.json):
  1. upload corpus/*.txt as documents and wait until they are READY
  2. create an alignment project on the base model and wait until it is READY
  3. deploy the aligned model and wait until it is DEPLOYED
  4. write NUGEN_MODEL_ID into backend/.env so the Go backend uses it

Usage: python align.py [status|retry]      (reads NUGEN_API_KEY from backend/.env)
Docs:  https://docs.nugen.in
"""
import json
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
ENV = HERE.parents[1] / "backend" / ".env"
STATE = HERE / "state.json"
API = "https://api.nugen.in/api/v3"
BASE_MODEL = "llama-v3p2-3b-reasoning"  # alignment-ready text model on Nugen


def env(key):
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')
    return ""


def set_env(key, value):
    lines = ENV.read_text(encoding="utf-8").splitlines()
    for i, line in enumerate(lines):
        if line.startswith(key + "="):
            lines[i] = f"{key}={value}"
            break
    else:
        lines.append(f"{key}={value}")
    ENV.write_text("\n".join(lines) + "\n", encoding="utf-8")


KEY = env("NUGEN_API_KEY")
H = {"Authorization": f"Bearer {KEY}", "accept": "application/json"}


def state():
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save(s):
    STATE.write_text(json.dumps(s, indent=2))


def call(method, path, **kw):
    r = requests.request(method, API + path, headers=H, timeout=120, **kw)
    if r.status_code >= 300:
        raise SystemExit(f"{method} {path} -> {r.status_code}: {r.text[:500]}")
    return r.json() if r.content else {}


def wait(what, fn, done, fail=("FAILED", "STOPPED"), every=20, limit=6 * 3600):
    start = time.time()
    while True:
        st = fn()
        print(f"  {what}: {st}", flush=True)
        if st in done:
            return st
        if st in fail:
            raise SystemExit(f"{what} ended as {st}")
        if time.time() - start > limit:
            raise SystemExit(f"{what} still {st} after {limit // 60} min; run again later to resume")
        time.sleep(every)


def upload(s):
    if s.get("document_ids"):
        return
    files = sorted((HERE / "corpus").glob("*.txt"))
    if not files:
        raise SystemExit("No corpus. Run build_corpus.py first.")
    parts = [("files", (f.name, f.read_bytes(), "text/plain")) for f in files]
    parts += [("names", (None, f.stem)) for f in files]
    parts += [("categories", (None, "trizpyy-travel")) for f in files]
    out = call("POST", "/documents/create", files=parts)
    s["document_ids"] = out["document_ids"]
    save(s)
    print(f"uploaded {len(files)} documents")


def docs_ready(s):
    for d in s["document_ids"]:
        wait(f"document {d}", lambda d=d: call("GET", f"/documents/{d}/status").get("status"), {"READY"}, every=5, limit=1800)


def align(s):
    if s.get("alignment_id"):
        return
    out = call("POST", "/alignment-projects/create", json={
        "alignment_name": "Trizpyy travel assistant",
        "base_model_id": BASE_MODEL,
        "document_ids": s["document_ids"],
        "description": "Trizpyy domain model: 20 Indian destination guides, 130 experiences, stays, transport, trip-change and refund rules, and grounded traveler Q&A.",
    })
    s["alignment_id"] = out["alignment_id"]
    save(s)
    set_env("NUGEN_ALIGNMENT_ID", s["alignment_id"])
    print("alignment started:", s["alignment_id"])


def aligned_model(s):
    wait("alignment", lambda: call("GET", f"/alignment-projects/{s['alignment_id']}/status").get("status"),
         {"READY", "EVALUATED", "UNDEPLOYED", "DEPLOYING"}, every=60)
    detail = call("GET", f"/alignment-projects/{s['alignment_id']}")
    s["model_id"] = detail.get("model_id") or s.get("model_id") or ""
    if not s["model_id"]:
        # Aligned models are also listed here once training finishes.
        models = call("GET", "/models/aligned").get("domain_aligned_models", [])
        mine = [m for m in models if s["alignment_id"] in json.dumps(m)]
        if mine:
            s["model_id"] = mine[0].get("model_id", "")
    save(s)
    if not s["model_id"]:
        raise SystemExit(f"Alignment is done but no model id yet. Detail: {json.dumps(detail)[:800]}")
    print("aligned model:", s["model_id"])


def deploy(s):
    mid = s["model_id"]
    status = call("GET", f"/models/{mid}/deployment/status").get("status")
    if status != "DEPLOYED":
        if status == "UNDEPLOYED":
            out = call("POST", f"/models/{mid}/deployment")
            s["model_id"] = out.get("model_id", mid)
            save(s)
        wait("deployment", lambda: call("GET", f"/models/{s['model_id']}/deployment/status").get("status"), {"DEPLOYED"},
             fail=("FAILED",), every=30, limit=3600)
    set_env("NUGEN_MODEL_ID", s["model_id"])
    print("DEPLOYED. NUGEN_MODEL_ID written to backend/.env:", s["model_id"])


def main():
    if not KEY:
        raise SystemExit("Set NUGEN_API_KEY in backend/.env")
    s = state()
    if len(sys.argv) > 1 and sys.argv[1] == "retry":
        # A failed alignment (e.g. Nugen's GPU job could not start) is retried on the same documents.
        s.setdefault("failed_alignments", []).append(s.pop("alignment_id", None))
        s.pop("model_id", None)
        save(s)
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        print(json.dumps(s, indent=2))
        if s.get("alignment_id"):
            print(call("GET", f"/alignment-projects/{s['alignment_id']}/status"))
        return
    upload(s)
    docs_ready(s)
    align(s)
    aligned_model(s)
    deploy(s)


if __name__ == "__main__":
    main()
