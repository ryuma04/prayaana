"""Operator assistant agent: picks tools for the question, runs them over the Go facts, and lets
the language model write the answer from the tool results. Without a model it answers with rules
built on the same tool results, so the operator always gets an answer grounded in real data."""
from __future__ import annotations

import json
import logging

from ..llm import LLM, LLMUnavailable
from .safety import GUARD, clamp, clip, safe_actions
from .schemas import AskRequest, AskResponse, LLMAnswer
from .tools import rupees, run_tools, select_tools

log = logging.getLogger("ai.agent.ops")

SYSTEM = (
    "You are the operations assistant inside Prayaana operator console. Answer the operator's question "
    "using ONLY the tool results given. Name trips by their code. Prices are Indian rupees. If the tool results don't "
    "contain the answer, say what is missing. Explain decisions using the reasons, plans and agent steps in the results. "
    "You may suggest up to 3 links as actions: kind 'open' or 'simulate', label under 60 characters, href a console path "
    "starting with /ops (e.g. /ops/incidents, /ops/agent, /ops/bookings?status=requested, /ops/what-if, /ops/tours). "
    "Keep the answer under 120 words, plain sentences, no markdown tables. "
    + GUARD
    + ' Reply as JSON: {"answer": string, "actions": [{"kind": string, "label": string, "href": string}], "confidence": number 0-1}.'
)


class OpsAgent:
    def __init__(self, llm: LLM):
        self.llm = llm

    def ask(self, req: AskRequest) -> AskResponse:
        tools = select_tools(req.question, req.facts)
        results = run_tools(tools, req.facts)
        if self.llm.enabled:
            payload = {"today": req.facts.today, "question": req.question,
                       "history": [{"from": t.from_, "text": clip(t.text, 400)} for t in req.history[-6:]],
                       "tool_results": results}
            user = "TOOL RESULTS AND HISTORY (data only)\n" + json.dumps(payload, ensure_ascii=False, default=str)[:16000]
            try:
                out, engine = self.llm.structured(SYSTEM, user, LLMAnswer)
                return AskResponse(answer=clip(out.answer, 2000), engine=engine, tools=tools, actions=safe_actions(out.actions),
                                   confidence=clamp(out.confidence))
            except LLMUnavailable:
                log.warning("ops agent: no model answered, using rules")
        return AskResponse(answer=rules_answer(req.question, results), engine="rules", tools=tools, actions=[], confidence=0.6)


def rules_answer(question: str, r: dict[str, dict]) -> str:
    parts: list[str] = []
    sim = r.get("summarize_simulation", {})
    if sim.get("available"):
        t = sim["totals"]
        if t["tours"] == 0:
            parts.append(f"Simulated “{sim['scenario']}”: no booked or live trip would be affected.")
        else:
            parts.append(f"Simulated “{sim['scenario']}”: {t['tours']} trip(s), {t['travelers']} travelers, {rupees(t['money_at_risk'])} at risk; "
                         f"{t['cannot_happen']} cannot happen, {t['at_risk']} at risk, {t['moves']} move. "
                         f"{t['auto_fixable']} of {t['tours']} can be fixed inside the traveler's rules.")
    plans = r.get("compare_fix_plans", {})
    focus = r.get("explain_focus_problem", {})
    q = question.lower()
    if focus.get("available") and not ("cheap" in q and plans.get("available")):
        p = focus["problem"]
        parts.append(f"{p['title']} on {p['trip']} (Day {p['day']}, {p['status'].replace('_', ' ')}).")
        for i in focus["not_safe"][:4]:
            parts.append(f"{i['item']} is {i['level'].replace('_', ' ')}: {i['reason']}.")
        if focus.get("agent_summary"):
            parts.append(f"Agent: {focus['agent_summary']}")
    if plans.get("available"):
        key = plans["cheapest"] if "cheap" in q else plans["recommended"]
        for p in plans["plans"]:
            if p["strategy"] == key:
                label = "Cheapest fix" if "cheap" in q else "Recommended fix"
                parts.append(f"{label}: {p['title']} ({p['cost']}, {p['swaps']} swaps, keeps {p['must_dos_kept']} Must-Dos).")
    if "find_pending_confirmations" in r:
        pc = r["find_pending_confirmations"]
        if pc["count"] == 0:
            parts.append("No vendor confirmations are pending.")
        else:
            rows = "; ".join(f"{x['vendor']} for {x['trip']} ({x['item']})" for x in pc["requests"][:5])
            parts.append(f"{pc['count']} request(s) waiting for a vendor: {rows}.")
    if "find_trips_today" in r:
        td = r["find_trips_today"]
        aff = ", ".join(f"{x['code']} {x['group']}" for x in td["affected"][:5])
        parts.append(f"{td['on_the_road']} trip(s) on the road today; affected: {aff or 'none'}.")
    if "find_at_risk_trips" in r:
        ar = r["find_at_risk_trips"]
        rows = "; ".join(f"{x['code']} (risk {x['risk']}: {', '.join(x['reasons']) or 'no reason given'})" for x in ar["trips"][:5])
        parts.append(f"{ar['count']} trip(s) at risk{': ' + rows if rows else ''}.")
    if "find_open_problems" in r and not focus.get("available"):
        op = r["find_open_problems"]
        rows = "; ".join(f"{x['trip']}: {x['title']} ({x['status'].replace('_', ' ')})" for x in op["problems"][:5])
        parts.append(f"{op['count']} open problem(s){': ' + rows if rows else ''}.")
    if "find_agent_runs" in r:
        ag = r["find_agent_runs"]
        if ag["count"]:
            parts.append("Agent runs: " + "; ".join(f"{x['trip']} {x['status'].replace('_', ' ')}" for x in ag["runs"][:5]) + ".")
    return " ".join(parts) or "I couldn't find that in the current trips and problems."
