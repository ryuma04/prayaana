import sys
from pathlib import Path

_services_ai = str(Path(__file__).resolve().parents[1])
if _services_ai not in sys.path:
    sys.path.insert(0, _services_ai)

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.search import Index


@pytest.fixture(scope="module")
def client():
    idx = Index(database_url="", use_pgvector=False)
    idx.load()  # real model, in memory (tests never write to a database)
    with TestClient(create_app(index=idx, load_index=False)) as c:
        yield c


def stops(**over):
    base = [
        {"id": "temple", "title": "Temple", "lat": 32.248, "lng": 77.180, "duration_min": 75, "open_min": 540, "close_min": 1110},
        {"id": "museum", "title": "Museum", "lat": 32.243, "lng": 77.187, "duration_min": 75, "open_min": 600, "close_min": 1080},
        {"id": "cafe", "title": "Cafe", "lat": 32.256, "lng": 77.176, "duration_min": 120, "open_min": 1020, "close_min": 1350},
    ]
    for s in base:
        s.update(over.get(s["id"], {}))
    return base


def test_health(client):
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["optimizer"] == "ortools"
    assert h["delay_model"]["validated_on_real_delays"] is False


def test_optimizer_orders_inside_windows(client):
    r = client.post("/optimize/day", json={"start": {"lat": 32.24, "lng": 77.19}, "stops": stops(), "day_start_min": 540}).json()
    assert r["feasible"] and [v["id"] for v in r["order"]][-1] == "cafe"
    for v in r["order"]:
        s = next(x for x in stops() if x["id"] == v["id"])
        assert s["open_min"] <= v["start_min"] and v["end_min"] <= s["close_min"]


def test_optimizer_rejects_bad_input(client):
    r = client.post("/optimize/day", json={"stops": stops(temple={"open_min": 900, "close_min": 800})})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation"
    r = client.post("/optimize/day", json={"stops": [], "travel_minutes": [[0]]})
    assert r.status_code == 422


def test_optimizer_reports_impossible_day(client):
    r = client.post("/optimize/day", json={"start": {"lat": 32.24, "lng": 77.19}, "day_start_min": 540,
                                           "stops": stops(museum={"duration_min": 600})}).json()
    assert not r["feasible"] and r["conflicts"] and r["order"] == []
    r = client.post("/optimize/day", json={"start": {"lat": 32.24, "lng": 77.19}, "stops": stops(temple={"weather_ok": False})}).json()
    assert not r["feasible"] and "weather" in r["conflicts"][0]


def test_semantic_similarity_and_search(client):
    if client.get("/health").json()["semantic"]["status"] != "ready":
        pytest.skip("semantic model could not load")
    sim = client.post("/similar", json={"activity_id": "ham-vittala", "k": 3}).json()["results"]
    assert sim and all(r["destination_id"] == "hampi" and r["id"] != "ham-vittala" for r in sim)
    top = client.post("/search", json={"query": "quiet cultural experience with little walking", "destination_id": "hampi", "k": 3}).json()["results"]
    assert top[0]["score"] >= top[-1]["score"] and any("culture" in r["interests"] or "relax" in r["interests"] for r in top)
    assert client.post("/similar", json={"activity_id": "nope"}).status_code == 404


def test_delay_risk_ranks_rainy_long_transfer_higher(client):
    base = {"mode": "bus", "distance_km": 20, "rain_chance": 5, "depart_min": 780, "buffer_min": 90}
    risky = {**base, "transfer_id": "b", "distance_km": 500, "rain_chance": 90, "depart_min": 480, "peak_season": True, "buffer_min": 5}
    r = client.post("/risk/delay", json={"transfers": [{**base, "transfer_id": "a"}, risky]}).json()
    a, b = r["risks"]
    assert b["risk_score"] > a["risk_score"] and b["factors"]
    assert r["metadata"]["validated_on_real_delays"] is False


def test_vendor_reliability(client):
    r = client.post("/vendors/reliability", json={"vendors": [
        {"vendor_id": "good", "answered": 40, "declined": 1, "expired": 0},
        {"vendor_id": "bad", "answered": 10, "declined": 5, "expired": 4},
        {"vendor_id": "new", "answered": 0, "declined": 0, "expired": 0}]}).json()["vendors"]
    good, bad, new = r
    assert good["failure_probability"] < new["failure_probability"] < bad["failure_probability"]
    assert bad["needs_backup"] and not good["needs_backup"] and new["evidence"] == 0
