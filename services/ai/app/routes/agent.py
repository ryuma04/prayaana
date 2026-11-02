"""Versioned AI agent endpoints (/v1/agent/*). The Go backend calls them with the facts it
collected; when they fail or are slow, Go answers on its own (backend/internal/ops/assistant.go)."""
from __future__ import annotations

from fastapi import APIRouter

from ..agents import OpsAgent, WhatIfAgent
from ..agents.schemas import AskRequest, AskResponse, InterpretRequest, WhatIfInsight
from ..llm import LLM


def build_router(llm: LLM) -> APIRouter:
    router = APIRouter(prefix="/v1/agent", tags=["agent"])
    ops, whatif = OpsAgent(llm), WhatIfAgent(llm)

    @router.get("/health")
    def health():
        return {"status": "ready" if llm.enabled else "rules-only", "llm": llm.engines}

    @router.post("/ops/ask", response_model=AskResponse)
    def ask(req: AskRequest):
        return ops.ask(req)

    @router.post("/whatif/interpret", response_model=WhatIfInsight)
    def interpret(req: InterpretRequest):
        return whatif.interpret(req.simulation)

    return router
