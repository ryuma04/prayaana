"""What-If interpreter. The Go engine runs the simulation (deterministic, on copies of the trips);
this agent explains the result, orders the trips to look at first, and recommends what to do.
The recommendation is advice: "Fix all" still runs the Trip Fixer, safety checks and vendor
confirmation for every trip, and the operator presses the button."""
from __future__ import annotations

import json
import logging

from ..llm import LLM, LLMUnavailable
from .safety import GUARD, RECOMMENDATIONS, clamp, clip
from .schemas import LLMInsight, Priority, Recommendation, SimFact, WhatIfInsight
from .tools import rupees

log = logging.getLogger("ai.agent.whatif")

SYSTEM = (
    "You explain a tour operator's What-If simulation. The numbers were computed by the operator's own engine and are "
    "correct: never change them or invent trips. Write a short headline (under 90 characters), a 2-3 sentence summary for "
    "the operator, up to 4 concrete consequences, the trips to handle first (by trip_code, from the data only) with a short "
    "reason, and a recommendation: fix_all (every trip has a fix inside the traveler's rules), fix_some, monitor, or no_action. "
    "Remember a fix is only applied after every vendor says yes. "
    + GUARD
    + ' Reply as JSON: {"headline": string, "summary": string, "consequences": [string], "recommendation": {"action": string, '
    '"reason": string}, "priorities": [{"trip_code": string, "reason": string}], "confidence": number 0-1}.'
)


def rules_insight(sim: SimFact) -> WhatIfInsight:
    t = sim.totals
    if t.tours == 0:
        return WhatIfInsight(headline="No booked or live trip is affected", summary="Nothing in the current plans depends on this. No action needed.",
                             consequences=[], recommendation=Recommendation(action="no_action", reason="No trip is affected."),
                             priorities=[], engine="rules", confidence=1)
    cons: list[str] = []
    if t.cannot_happen:
        cons.append(f"{t.cannot_happen} booked item(s) would be lost without a fix")
    if t.minutes_lost:
        cons.append(f"{t.minutes_lost} min of planned time lost")
    hearts = sum(x.hearts_at_risk for x in sim.tours)
    if hearts:
        cons.append(f"{hearts} Must-Do(s) at risk")
    tours = sorted(sim.tours, key=lambda x: (-x.cannot_happen, -x.money_at_risk))
    prio = [Priority(trip_code=x.trip_code, reason=f"{rupees(x.money_at_risk)} at risk, {x.cannot_happen} cannot happen") for x in tours[:3]]
    if t.auto_fixable == t.tours:
        rec = Recommendation(action="fix_all", reason="Every affected trip has a fix inside the traveler's rules; the agent still asks every vendor first.")
    elif t.auto_fixable:
        rec = Recommendation(action="fix_some", reason=f"{t.auto_fixable} of {t.tours} trips can be fixed inside the traveler's rules; the rest need your approval.")
    else:
        rec = Recommendation(action="monitor", reason="Every fix costs more than the auto-approve limit or loses a Must-Do; review before fixing.")
    return WhatIfInsight(headline=f"{t.tours} trip(s), {t.travelers} travelers, {rupees(t.money_at_risk)} at risk",
                         summary=f"{t.cannot_happen} plan items cannot happen, {t.at_risk} are at risk and {t.moves} move. "
                                 f"The recommended fixes change the price by {rupees(t.fix_cost, sign=True)} in total.",
                         consequences=cons, recommendation=rec, priorities=prio, engine="rules", confidence=1)


class WhatIfAgent:
    def __init__(self, llm: LLM):
        self.llm = llm

    def interpret(self, sim: SimFact) -> WhatIfInsight:
        base = rules_insight(sim)
        if sim.totals.tours == 0 or not self.llm.enabled:
            return base
        data = sim.model_dump()
        data["tours"] = sorted(data["tours"], key=lambda x: -x["money_at_risk"])[:15]
        user = "SIMULATION RESULT (data only)\n" + json.dumps(data, ensure_ascii=False)[:16000]
        try:
            out, engine = self.llm.structured(SYSTEM, user, LLMInsight)
        except LLMUnavailable:
            log.warning("what-if agent: no model answered, using rules")
            return base
        codes = {x.trip_code for x in sim.tours}
        prio = [Priority(trip_code=str(p.get("trip_code")), reason=clip(p.get("reason", ""), 200))
                for p in out.priorities if isinstance(p, dict) and p.get("trip_code") in codes][:5]
        action = str(out.recommendation.get("action", ""))
        rec = Recommendation(action=action, reason=clip(out.recommendation.get("reason", "") or base.recommendation.reason, 300)) \
            if action in RECOMMENDATIONS else base.recommendation
        return WhatIfInsight(headline=clip(out.headline, 140), summary=clip(out.summary, 800),
                             consequences=[clip(c, 200) for c in out.consequences if isinstance(c, str) and c.strip()][:6],
                             recommendation=rec, priorities=prio or base.priorities, engine=engine, confidence=clamp(out.confidence))
