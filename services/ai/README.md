# Prayaana AI Service (FastAPI)

Microservice called by the Go backend over HTTP (`AI_SERVICE_URL`). When offline or unreachable, the Go backend gracefully falls back to deterministic rules — ensuring 100% platform availability.

## Endpoints

| Endpoint | Method | Technical Purpose |
|---|---|---|
| `/health` | GET | Service status, semantic model status (`loading` / `ready` / `unavailable`), activity vector count |
| `/optimize/day` | POST | Google OR-Tools routing engine with time windows; sequences sights to minimize travel time and respect opening hours |
| `/similar` | POST | Activity similarity via `sentence-transformers/all-MiniLM-L6-v2` |
| `/search` | POST | Semantic search-by-feeling (*"misty hills with authentic coffee"*) |
| `/similarity-matrix`| GET | Pairwise similarity matrix within destinations for candidate replacement ranking |
| `/risk/delay` | POST | Delay-risk logistic regression forecasting late transfers based on weather and route features |
| `/vendors/reliability` | POST | Beta-Binomial inference estimating probability of partner fulfillment with a 90% credible interval |

## Setup & Running

```bash
cd services/ai
python -m venv .venv

# Activate venv:
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --port 8090 --reload
```

## Running Tests

```bash
python -m pytest -v
```
Runs the 15-test suite covering routing, constraints, risk estimation, and agent guardrails.
