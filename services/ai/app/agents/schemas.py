"""The agent's contract with the Go backend (backend/internal/aisvc/agent.go).

Facts are sent by Go, which stays the source of truth: the agent never reads the database and
never changes a trip. Unknown fields are ignored so Go can add facts without breaking the agent.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Loose(BaseModel):
    model_config = ConfigDict(extra="ignore")


# ── Facts (Go → agent) ──

class TripFact(Loose):
    id: str = ""
    code: str = ""
    group: str = ""
    destination: str = ""
    status: str = ""
    risk: int = 0
    risk_reasons: list[str] = []
    travelers: int = 0
    start_date: str = ""
    end_date: str = ""
    current_day: int = 0
    pending_vendors: int = 0


class IncidentFact(Loose):
    id: str = ""
    trip_code: str = ""
    title: str = ""
    detail: str = ""
    kind: str = ""
    status: str = ""
    severity: int = 0
    day: int = 0
    run_status: str = ""


class PendingFact(Loose):
    vendor: str = ""
    trip_code: str = ""
    item: str = ""
    proposed: str = ""
    kind: str = ""
    age_min: int = 0


class RunFact(Loose):
    id: str = ""
    incident_id: str = ""
    trip_code: str = ""
    status: str = ""
    attempt: int = 0
    summary: str = ""
    last_step: str = ""


class ImpactFact(Loose):
    title: str = ""
    day: int = 0
    start_min: int = 0
    level: str = ""
    reason: str = ""
    cost_at_risk: int = 0


class PlanFact(Loose):
    strategy: str = ""
    title: str = ""
    cost_delta: int = 0
    time_delta_min: int = 0
    hearts_kept: int = 0
    hearts_total: int = 0
    swaps: int = 0
    confidence: int = 0
    recommended: bool = False
    actions: list[str] = []


class StepFact(Loose):
    tool: str = ""
    label: str = ""
    status: str = ""
    result: str = ""


class FocusFact(Loose):
    incident: IncidentFact = IncidentFact()
    impact: list[ImpactFact] = []
    money_at_risk: int = 0
    minutes_lost: int = 0
    plans: list[PlanFact] = []
    steps: list[StepFact] = []
    run_summary: str = ""


class SimTourFact(Loose):
    trip_code: str = ""
    group: str = ""
    day: int = 0
    travelers: int = 0
    money_at_risk: int = 0
    minutes_lost: int = 0
    safe: int = 0
    moves: int = 0
    at_risk: int = 0
    cannot_happen: int = 0
    hearts_at_risk: int = 0
    best_plan: str = ""
    best_strategy: str = ""
    fix_cost: int = 0
    fix_time_min: int = 0
    auto_fixable: bool = False
    items: list[ImpactFact] = []


class SimTotals(Loose):
    tours: int = 0
    travelers: int = 0
    money_at_risk: int = 0
    minutes_lost: int = 0
    auto_fixable: int = 0
    safe: int = 0
    moves: int = 0
    at_risk: int = 0
    cannot_happen: int = 0
    fix_cost: int = 0


class SimFact(Loose):
    title: str = ""
    question: str = ""
    destination: str = ""
    kind: str = ""
    when: str = ""
    tours: list[SimTourFact] = []
    totals: SimTotals = SimTotals()


class OpsFacts(Loose):
    today: str = ""
    trips: list[TripFact] = []
    incidents: list[IncidentFact] = []
    pending_confirmations: list[PendingFact] = []
    agent_runs: list[RunFact] = []
    focus: FocusFact | None = None
    simulation: SimFact | None = None


class Turn(Loose):
    from_: Literal["operator", "assistant"] = Field(alias="from")
    text: str = Field(max_length=2000)


# ── Requests ──

class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    history: list[Turn] = Field(default=[], max_length=12)
    facts: OpsFacts = OpsFacts()


class InterpretRequest(BaseModel):
    simulation: SimFact


# ── Results (agent → Go) ──

ActionKind = Literal["open", "simulate"]
RecommendationAction = Literal["fix_all", "fix_some", "monitor", "no_action"]


class Action(BaseModel):
    kind: ActionKind
    label: str = Field(max_length=60)
    href: str = Field(max_length=300)


class AskResponse(BaseModel):
    answer: str
    engine: str
    tools: list[str]
    actions: list[Action]
    confidence: float = Field(ge=0, le=1)


class Recommendation(BaseModel):
    action: RecommendationAction
    reason: str


class Priority(BaseModel):
    trip_code: str
    reason: str


class WhatIfInsight(BaseModel):
    headline: str
    summary: str
    consequences: list[str]
    recommendation: Recommendation
    priorities: list[Priority]
    engine: str
    confidence: float = Field(ge=0, le=1)


# ── What the language model must return (validated before use) ──

class LLMAnswer(Loose):
    answer: str = Field(min_length=1, max_length=3000)
    actions: list[dict] = []
    confidence: float = 0.7


class LLMInsight(Loose):
    headline: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=1200)
    consequences: list[str] = []
    recommendation: dict = {}
    priorities: list[dict] = []
    confidence: float = 0.7
