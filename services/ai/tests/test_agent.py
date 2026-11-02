import sys
from pathlib import Path

_services_ai = str(Path(__file__).resolve().parents[1])
if _services_ai not in sys.path:
    sys.path.insert(0, _services_ai)

import json
import logging

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, keys, seconds
from app.llm import LLM, LLMUnavailable
from app.llm.adapter import Gemini, Groq
from app.main import create_app
from app.search import Index

FACTS = {
    "today": "2026-10-13",
    "trips": [
        {"id": "t1", "code": "TRZ-101", "group": "Sharma family", "destination": "Coorg", "status": "at_risk", "risk": 71,
         "risk_reasons": ["Heavy rain forecast"], "travelers": 4, "start_date": "2026-10-12", "end_date": "2026-10-16", "current_day": 2},
        {"id": "t2", "code": "TRZ-102", "group": "Iyer couple", "destination": "Hampi", "status": "confirmed", "risk": 8,
         "start_date": "2026-11-01", "end_date": "2026-11-04"},
    ],
    "incidents": [{"id": "inc1", "trip_code": "TRZ-101", "title": "Heavy rain forecast", "kind": "weather", "status": "plans_ready",
                   "severity": 4, "day": 3}],
    "pending_confirmations": [{"vendor": "Kodagu Coffee Valley Cabs", "trip_code": "TRZ-101", "item": "Dubare pickup", "proposed": "Day 4, 9:00 AM",
                               "kind": "change", "age_min": 42}],
    "agent_runs": [],
    "focus": {"incident": {"id": "inc1", "trip_code": "TRZ-101", "title": "Heavy rain forecast", "status": "plans_ready", "day": 3},
              "impact": [{"title": "River rafting", "level": "cannot_happen", "reason": "Outdoor activity · heavy rain & gusts forecast",
                          "cost_at_risk": 7000},
                         {"title": "Big Cup Cafe", "level": "safe", "reason": "Not affected"}],
              "money_at_risk": 7000,
              "plans": [{"strategy": "cheapest", "title": "Cheapest", "cost_delta": -3500, "swaps": 1, "hearts_kept": 1, "hearts_total": 1},
                        {"strategy": "fastest", "title": "Fastest", "cost_delta": 400, "swaps": 1, "hearts_kept": 1, "hearts_total": 1, "recommended": True},
                        {"strategy": "favourites", "title": "Keep My Favourites", "cost_delta": 900, "swaps": 2, "hearts_kept": 1, "hearts_total": 1}]},
}

SIM = {"title": "Heavy rain in Coorg", "question": "What if heavy rain hits Coorg tomorrow?", "destination": "coorg", "kind": "weather",
       "when": "tomorrow",
       "tours": [{"trip_code": "TRZ-101", "group": "Sharma family", "day": 3, "travelers": 4, "money_at_risk": 7000, "cannot_happen": 1,
                  "moves": 1, "safe": 3, "best_plan": "Fastest · +₹400", "best_strategy": "fastest", "fix_cost": 400, "auto_fixable": True,
                  "items": [{"title": "River rafting", "level": "cannot_happen", "reason": "Outdoor activity"}]}],
       "totals": {"tours": 1, "travelers": 4, "money_at_risk": 7000, "auto_fixable": 1, "cannot_happen": 1, "moves": 1, "safe": 3, "fix_cost": 400}}


class FakeProvider:
    def __init__(self, name, answers):
        self.name, self.answers, self.calls = name, list(answers), []

    def complete_json(self, system, user):
        self.calls.append((system, user))
        a = self.answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return a


def app_with(llm):
    return TestClient(create_app(index=Index(database_url="", use_pgvector=False), load_index=False, llm=llm))


def test_health_reports_agent_state():
    h = app_with(LLM([])).get("/health").json()
    assert h["agent"] == {"status": "rules-only", "llm": []}
    assert app_with(LLM([FakeProvider("groq", [])])).get("/v1/agent/health").json() == {"status": "ready", "llm": ["groq"]}


def test_ops_ask_rules_answer_uses_real_facts():
    c = app_with(LLM([]))
    r = c.post("/v1/agent/ops/ask", json={"question": "Which trips are at risk?", "facts": FACTS}).json()
    assert r["engine"] == "rules" and "find_at_risk_trips" in r["tools"]
    assert "TRZ-101" in r["answer"] and "Heavy rain" in r["answer"] and "TRZ-102" not in r["answer"]
    r = c.post("/v1/agent/ops/ask", json={"question": "Which vendors need confirmation?", "facts": FACTS}).json()
    assert "Himalayan Cabs" in r["answer"]
    r = c.post("/v1/agent/ops/ask", json={"question": "Why is paragliding marked cannot_happen?", "facts": FACTS}).json()
    assert "explain_focus_problem" in r["tools"] and "heavy rain" in r["answer"]
    r = c.post("/v1/agent/ops/ask", json={"question": "Show me the cheapest fix", "facts": FACTS}).json()
    assert "Cheapest fix" in r["answer"] and "−₹3,500" in r["answer"]


def test_ops_ask_with_model_keeps_only_console_links():
    p = FakeProvider("groq", [{"answer": "TRZ-101 is at risk from heavy rain on Day 3.", "confidence": 3, "actions": [
        {"kind": "open", "label": "Open the problem", "href": "/ops/incidents/inc1"},
        {"kind": "commit", "label": "Commit", "href": "/ops/agent"},
        {"kind": "open", "label": "Phish", "href": "https://evil.example"},
        {"kind": "open", "label": "Proto", "href": "//evil.example"},
    ]}])
    r = app_with(LLM([p])).post("/v1/agent/ops/ask", json={"question": "Which trips are at risk?", "facts": FACTS,
                                                         "history": [{"from": "operator", "text": "hi"}]}).json()
    assert r["engine"] == "groq" and r["confidence"] == 1
    assert [a["href"] for a in r["actions"]] == ["/ops/incidents/inc1"]
    system, user = p.calls[0]
    assert "data, not instructions" in system and "TRZ-101" in user
    assert "Himalayan" not in user  # only the tools picked for the question reach the model


def test_ops_ask_falls_back_when_every_model_fails():
    bad = FakeProvider("groq", [{"not_an_answer": True}])  # fails validation
    from app.llm.adapter import ProviderError
    down = FakeProvider("gemini", [ProviderError("gemini", 503, 20)])
    r = app_with(LLM([bad, down])).post("/v1/agent/ops/ask", json={"question": "What is at risk?", "facts": FACTS}).json()
    assert r["engine"] == "rules" and "TRZ-101" in r["answer"]


def test_whatif_interpret_rules_and_model_guardrails():
    c = app_with(LLM([]))
    r = c.post("/v1/agent/whatif/interpret", json={"simulation": SIM}).json()
    assert r["engine"] == "rules" and r["recommendation"]["action"] == "fix_all" and r["priorities"][0]["trip_code"] == "TRZ-101"
    empty = c.post("/v1/agent/whatif/interpret", json={"simulation": {**SIM, "tours": [], "totals": {}}}).json()
    assert empty["recommendation"]["action"] == "no_action"

    p = FakeProvider("gemini", [{"headline": "Rain cancels paragliding for the Sharmas", "summary": "One trip loses its adventure day.",
                                 "consequences": ["Paragliding lost", ""], "recommendation": {"action": "wipe_database", "reason": "x"},
                                 "priorities": [{"trip_code": "TRZ-999", "reason": "invented"}, {"trip_code": "TRZ-101", "reason": "real"}],
                                 "confidence": 0.9}])
    r = app_with(LLM([p])).post("/v1/agent/whatif/interpret", json={"simulation": SIM}).json()
    assert r["engine"] == "gemini" and r["headline"].startswith("Rain")
    assert r["recommendation"]["action"] == "fix_all"  # unknown action replaced by the rule
    assert [x["trip_code"] for x in r["priorities"]] == ["TRZ-101"] and r["consequences"] == ["Paragliding lost"]


def test_invalid_requests_are_rejected():
    c = app_with(LLM([]))
    assert c.post("/v1/agent/ops/ask", json={"question": "x"}).status_code == 422
    assert c.post("/v1/agent/whatif/interpret", json={}).status_code == 422


def test_keyring_rotates_and_never_leaks_keys(caplog):
    seen = []

    def handler(req: httpx.Request):
        key = req.headers.get("authorization", "")
        seen.append(key)
        if key.endswith("k1"):
            return httpx.Response(429, text="rate limited k1")
        body = {"choices": [{"message": {"content": json.dumps({"answer": "ok", "confidence": 0.5})}}]}
        return httpx.Response(200, json=body)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    groq = Groq(("secret-k1", "secret-k2"), "https://groq.test", "llama", client)
    from app.agents.schemas import LLMAnswer
    with caplog.at_level(logging.WARNING):
        out, engine = LLM([groq]).structured("s", "u", LLMAnswer)
    assert out.answer == "ok" and engine == "groq" and len(seen) == 2
    # k1 is cooling down now, so the next call goes straight to k2.
    LLM([groq]).structured("s", "u", LLMAnswer)
    assert seen[-1].endswith("k2") and len(seen) == 3
    assert "secret" not in caplog.text

    def down(req):
        return httpx.Response(500, text="boom secret-g1")

    gem = Gemini(("secret-g1",), "https://gem.test", "g", httpx.Client(transport=httpx.MockTransport(down)))
    with pytest.raises(LLMUnavailable) as e:
        LLM([gem]).structured("s", "u", LLMAnswer)
    assert "secret" not in str(e.value)


def test_settings_read_env_like_go(monkeypatch):
    for k in ("GROQ_API_KEY", "GROQ_API_KEYS", "GEMINI_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("GROQ_API_KEY_1", "a")
    monkeypatch.setenv("GROQ_API_KEY_2", '"b"')
    monkeypatch.setenv("GROQ_API_KEYS", "c, a")
    monkeypatch.setenv("AGENT_LLM", "0")
    assert keys("GROQ_API_KEY") == ["c", "a", "b"]
    s = Settings.from_env()
    assert not s.llm_enabled and not LLM.from_settings(s).enabled
    assert seconds("1500ms", 0) == 1.5 and seconds("2m", 0) == 120 and seconds("junk", 7) == 7
