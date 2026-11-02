"""Trizpyy AI service (FastAPI). The Go backend calls it over HTTP; every endpoint is optional
for Go, which falls back to its own rules when this service is slow or down."""
from __future__ import annotations

import logging
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import reliability
from .config import Settings
from .llm import LLM
from .optimizer import optimize
from .routes.agent import build_router
from .risk import DelayModel
from .schemas import (DelayRiskRequest, DelayRiskResponse, MatchResponse, OptimizeRequest, OptimizeResponse,
                      ReliabilityRequest, ReliabilityResponse, SearchRequest, SimilarRequest)
from .search import MODEL_NAME, Index

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
STARTED = time.time()


def create_app(index: Index | None = None, load_index: bool = True, llm: LLM | None = None) -> FastAPI:
    idx = index or Index()
    llm = llm if llm is not None else LLM.from_settings(Settings.from_env())

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if load_index and idx.status == "loading":
            # The model takes a few seconds to load; the other endpoints work meanwhile.
            threading.Thread(target=idx.load, daemon=True).start()
        yield

    app = FastAPI(title="Prayaana AI service", version="1.0.0", lifespan=lifespan)
    app.state.index = idx
    app.state.delay = DelayModel()
    app.state.llm = llm

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        # The Go backend sends its request id so one operator action can be followed across both services.
        rid = request.headers.get("x-request-id", "")[:64]
        start = time.perf_counter()
        response = await call_next(request)
        if rid:
            response.headers["X-Request-ID"] = rid
        if request.url.path.startswith("/v1/"):
            logging.getLogger("ai").info("%s %s %s %.0fms rid=%s", request.method, request.url.path, response.status_code,
                                         (time.perf_counter() - start) * 1000, rid or "-")
        return response

    def fail(status: int, code: str, message: str, **extra) -> JSONResponse:
        return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, **extra}})

    @app.exception_handler(RequestValidationError)
    async def invalid(_: Request, exc: RequestValidationError):
        fields = [{"loc": ".".join(str(x) for x in e["loc"]), "message": e["msg"]} for e in exc.errors()]
        return fail(422, "validation", "The request is not valid.", fields=fields)

    @app.exception_handler(Exception)
    async def crashed(_: Request, exc: Exception):
        logging.getLogger("ai").exception("unhandled error")
        return fail(500, "internal", "The AI service hit an error.")

    def need_index():
        if not idx.ready():
            return fail(503, "model_unavailable", f"Semantic model is {idx.status}.", detail=idx.error)
        return None

    @app.get("/health")
    def health():
        return {"status": "ok", "uptime_s": round(time.time() - STARTED),
                "semantic": {"status": idx.status, "model": MODEL_NAME, "store": idx.store, "activities": len(idx.activities), "error": idx.error},
                "optimizer": "ortools", "delay_model": app.state.delay.card, "reliability": "beta-binomial",
                "agent": {"status": "ready" if llm.enabled else "rules-only", "llm": llm.engines}}

    @app.post("/optimize/day", response_model=OptimizeResponse)
    def optimize_day(req: OptimizeRequest):
        return optimize(req)

    @app.post("/similar", response_model=MatchResponse)
    def similar(req: SimilarRequest):
        if (r := need_index()) is not None:
            return r
        try:
            results = idx.similar(req.activity_id, req.k, req.same_destination, req.exclude_ids)
        except KeyError:
            return fail(404, "not_found", f"Unknown activity {req.activity_id}.")
        return {"results": results, "metadata": {"model": MODEL_NAME, "store": idx.store}}

    @app.post("/search", response_model=MatchResponse)
    def search(req: SearchRequest):
        if (r := need_index()) is not None:
            return r
        return {"results": idx.search(req.query, req.destination_id, req.k), "metadata": {"model": MODEL_NAME, "store": idx.store}}

    @app.get("/similarity-matrix")
    def matrix(destination_id: str | None = None):
        if (r := need_index()) is not None:
            return r
        return {"matrix": idx.matrix(destination_id), "metadata": {"model": MODEL_NAME}}

    @app.post("/risk/delay", response_model=DelayRiskResponse)
    def delay(req: DelayRiskRequest):
        return {"risks": [app.state.delay.predict(t) for t in req.transfers], "metadata": app.state.delay.card}

    @app.post("/vendors/reliability", response_model=ReliabilityResponse)
    def vendor_reliability(req: ReliabilityRequest):
        return {"vendors": [reliability.estimate(v) for v in req.vendors],
                "metadata": {"method": "beta-binomial", "prior": [reliability.PRIOR_A, reliability.PRIOR_B]}}

    app.include_router(build_router(llm))
    return app


app = create_app()
