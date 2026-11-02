"""The agent's tools. Each one reads the facts the Go backend sent and returns a small, typed
summary for the model. None of them calls the database or changes anything, and none repeats Go
business logic: impact levels, fix plans, prices and vendor answers are all computed by Go.
"""
from __future__ import annotations

import re
from typing import Callable

from .schemas import OpsFacts

Tool = Callable[[OpsFacts], dict]


def rupees(n: int, sign: bool = False) -> str:
    s = f"₹{abs(n):,}"
    if sign:
        return ("+" if n > 0 else "−" if n < 0 else "") + s
    return ("−" if n < 0 else "") + s


def find_open_problems(f: OpsFacts) -> dict:
    items = [{"id": i.id, "trip": i.trip_code, "title": i.title, "status": i.status, "severity": i.severity, "day": i.day,
              "agent": i.run_status or "not started"} for i in sorted(f.incidents, key=lambda i: -i.severity)]
    return {"count": len(items), "problems": items[:15]}


def find_at_risk_trips(f: OpsFacts) -> dict:
    risky = [t for t in f.trips if t.status == "at_risk" or t.risk >= 40]
    risky.sort(key=lambda t: -t.risk)
    return {"count": len(risky), "trips": [{"code": t.code, "group": t.group, "destination": t.destination, "status": t.status,
                                            "risk": t.risk, "reasons": t.risk_reasons} for t in risky[:15]]}


def find_trips_today(f: OpsFacts) -> dict:
    """Trips on the road today and which of them have an open problem."""
    live = [t for t in f.trips if t.status in ("live", "at_risk") and t.start_date <= f.today <= t.end_date]
    problems = {i.trip_code for i in f.incidents}
    return {"today": f.today, "on_the_road": len(live), "affected": [
        {"code": t.code, "group": t.group, "destination": t.destination, "day": t.current_day, "reasons": t.risk_reasons}
        for t in live if t.code in problems or t.status == "at_risk"][:15]}


def find_pending_confirmations(f: OpsFacts) -> dict:
    rows = sorted(f.pending_confirmations, key=lambda p: -p.age_min)
    return {"count": len(rows), "requests": [{"vendor": p.vendor, "trip": p.trip_code, "item": p.item, "proposed": p.proposed,
                                              "kind": p.kind, "waiting_min": p.age_min} for p in rows[:15]]}


def find_agent_runs(f: OpsFacts) -> dict:
    return {"count": len(f.agent_runs), "runs": [{"trip": r.trip_code, "status": r.status, "attempt": r.attempt, "summary": r.summary,
                                                  "last_step": r.last_step} for r in f.agent_runs[:10]]}


def explain_focus_problem(f: OpsFacts) -> dict:
    if f.focus is None:
        return {"available": False}
    x = f.focus
    return {"available": True, "problem": {"title": x.incident.title, "trip": x.incident.trip_code, "day": x.incident.day,
                                           "status": x.incident.status, "detail": x.incident.detail},
            "not_safe": [{"item": i.title, "level": i.level, "reason": i.reason, "cost_at_risk": i.cost_at_risk}
                         for i in x.impact if i.level != "safe"],
            "money_at_risk": x.money_at_risk, "minutes_lost": x.minutes_lost,
            "agent_steps": [{"tool": s.tool, "label": s.label, "status": s.status, "result": s.result} for s in x.steps[-12:]],
            "agent_summary": x.run_summary}


def compare_fix_plans(f: OpsFacts) -> dict:
    if f.focus is None or not f.focus.plans:
        return {"available": False}
    plans = f.focus.plans
    by = {p.strategy: p for p in plans}
    cheapest = min(plans, key=lambda p: p.cost_delta)
    return {"available": True, "cheapest": cheapest.strategy, "recommended": next((p.strategy for p in plans if p.recommended), ""),
            "plans": [{"strategy": p.strategy, "title": p.title, "cost": rupees(p.cost_delta, sign=True), "time_min": p.time_delta_min,
                       "must_dos_kept": f"{p.hearts_kept}/{p.hearts_total}", "swaps": p.swaps, "confidence": p.confidence,
                       "actions": p.actions[:6]} for p in by.values()]}


def summarize_simulation(f: OpsFacts) -> dict:
    if f.simulation is None:
        return {"available": False}
    s = f.simulation
    tours = sorted(s.tours, key=lambda t: -t.money_at_risk)
    return {"available": True, "scenario": s.title, "question": s.question, "when": s.when, "totals": s.totals.model_dump(),
            "tours": [{"trip": t.trip_code, "group": t.group, "day": t.day, "money_at_risk": t.money_at_risk, "cannot_happen": t.cannot_happen,
                       "at_risk": t.at_risk, "moves": t.moves, "best_plan": t.best_plan, "auto_fixable": t.auto_fixable,
                       "broken": [f"{i.title}: {i.reason}" for i in t.items if i.level in ("cannot_happen", "at_risk")][:4]}
                      for t in tours[:10]]}


TOOLS: dict[str, Tool] = {
    "find_open_problems": find_open_problems,
    "find_at_risk_trips": find_at_risk_trips,
    "find_trips_today": find_trips_today,
    "find_pending_confirmations": find_pending_confirmations,
    "find_agent_runs": find_agent_runs,
    "explain_focus_problem": explain_focus_problem,
    "compare_fix_plans": compare_fix_plans,
    "summarize_simulation": summarize_simulation,
}

_INTENTS: list[tuple[str, str]] = [
    (r"\b(vendor|vendors|partner|partners|confirm|confirmation|confirmations|reply|replies|waiting)\b", "find_pending_confirmations"),
    (r"\b(risk|risky|at.risk|danger)\b", "find_at_risk_trips"),
    (r"\b(today|now|right now|on the road|affected)\b", "find_trips_today"),
    (r"\b(problem|problems|incident|incidents|issue|issues|broken|affected)\b", "find_open_problems"),
    (r"\b(agent|fixer|run|runs|escalat\w*|human)\b", "find_agent_runs"),
    (r"\b(why|explain|reason|cannot.happen|decision|decided|chose|chosen)\b", "explain_focus_problem"),
    (r"\b(cheap\w*|fast\w*|favourite\w*|favorite\w*|plan|plans|fix|fixes|option|options)\b", "compare_fix_plans"),
    (r"\b(what if|what happens|simulat\w*|scenario|suppose)\b", "summarize_simulation"),
]


def select_tools(question: str, f: OpsFacts) -> list[str]:
    """Picks the tools for a question (code decides what data the model sees)."""
    q = question.lower()
    chosen: list[str] = []
    for pattern, tool in _INTENTS:
        if re.search(pattern, q) and tool not in chosen:
            chosen.append(tool)
    if f.simulation is not None and "summarize_simulation" not in chosen:
        chosen.insert(0, "summarize_simulation")
    if f.focus is not None:
        for t in ("explain_focus_problem", "compare_fix_plans"):
            if t not in chosen:
                chosen.append(t)
    if not chosen:
        chosen = ["find_open_problems", "find_at_risk_trips"]
    return chosen


def run_tools(names: list[str], f: OpsFacts) -> dict[str, dict]:
    return {n: TOOLS[n](f) for n in names if n in TOOLS}
