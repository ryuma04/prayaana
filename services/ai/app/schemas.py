"""Typed request/response models for the Trizpyy AI service."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

# ── Optimizer ────────────────────────────────────────────────────────────────


class Point(BaseModel):
    id: str = "start"
    name: str = "Start"
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class Stop(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    title: str = Field(default="", max_length=200)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    duration_min: int = Field(gt=0, le=16 * 60)
    open_min: int = Field(default=0, ge=0, le=24 * 60)
    close_min: int = Field(default=24 * 60, ge=0, le=24 * 60)
    required: bool = True
    weather_ok: bool = True
    energy: int = Field(default=1, ge=0, le=5)

    @model_validator(mode="after")
    def window(self) -> "Stop":
        if self.close_min <= self.open_min:
            raise ValueError(f"stop {self.id}: close_min must be after open_min")
        return self


class Precedence(BaseModel):
    before: str
    after: str


class OptimizeRequest(BaseModel):
    day: int = Field(default=1, ge=1, le=60)
    start: Point | None = None
    day_start_min: int = Field(default=8 * 60, ge=0, le=24 * 60)
    day_end_min: int = Field(default=23 * 60, ge=0, le=24 * 60)
    stops: list[Stop] = Field(min_length=1, max_length=40)
    # Minutes between nodes; index 0 is the start, then stops in order. Omit to use road estimates.
    travel_minutes: list[list[int]] | None = None
    return_to_start: bool = True
    max_energy: int | None = Field(default=None, ge=0, le=100)
    precedence: list[Precedence] = []
    time_limit_ms: int = Field(default=800, ge=50, le=5000)

    @model_validator(mode="after")
    def check(self) -> "OptimizeRequest":
        if self.day_end_min <= self.day_start_min:
            raise ValueError("day_end_min must be after day_start_min")
        ids = [s.id for s in self.stops]
        if len(set(ids)) != len(ids):
            raise ValueError("stop ids must be unique")
        n = len(self.stops) + 1
        if self.travel_minutes is not None:
            if len(self.travel_minutes) != n or any(len(r) != n for r in self.travel_minutes):
                raise ValueError(f"travel_minutes must be {n}x{n} (start + stops)")
            if any(v < 0 or v > 24 * 60 for r in self.travel_minutes for v in r):
                raise ValueError("travel_minutes values must be 0..1440")
        elif self.start is None or any(s.lat is None or s.lng is None for s in self.stops):
            raise ValueError("give travel_minutes, or a start point and lat/lng for every stop")
        for p in self.precedence:
            if p.before not in ids or p.after not in ids:
                raise ValueError(f"precedence refers to unknown stop {p.before} or {p.after}")
        return self


class Visit(BaseModel):
    id: str
    title: str
    start_min: int
    end_min: int
    travel_min: int


class Dropped(BaseModel):
    id: str
    reason: str


class OptimizeResponse(BaseModel):
    feasible: bool
    order: list[Visit]
    dropped: list[Dropped]
    conflicts: list[str]
    total_travel_min: int
    day_end_min: int | None
    metadata: dict


# ── Semantic search ──────────────────────────────────────────────────────────


class SimilarRequest(BaseModel):
    activity_id: str = Field(min_length=1)
    k: int = Field(default=5, ge=1, le=50)
    same_destination: bool = True
    exclude_ids: list[str] = []


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=300)
    destination_id: str | None = None
    k: int = Field(default=8, ge=1, le=50)


class Match(BaseModel):
    id: str
    title: str
    destination_id: str
    score: float
    interests: list[str]


class MatchResponse(BaseModel):
    results: list[Match]
    metadata: dict


# ── Delay risk ───────────────────────────────────────────────────────────────


class TransferIn(BaseModel):
    transfer_id: str = Field(min_length=1)
    mode: Literal["flight", "train", "bus", "car", "transfer"]
    distance_km: float = Field(ge=0, le=5000)
    rain_chance: int = Field(ge=0, le=100)
    depart_min: int = Field(ge=0, lt=24 * 60)
    peak_season: bool = False
    buffer_min: int = Field(default=30, ge=0, le=24 * 60)


class DelayRiskRequest(BaseModel):
    transfers: list[TransferIn] = Field(min_length=1, max_length=100)


class DelayRisk(BaseModel):
    transfer_id: str
    risk_score: float
    risk_level: Literal["low", "medium", "high"]
    factors: list[str]


class DelayRiskResponse(BaseModel):
    risks: list[DelayRisk]
    metadata: dict


# ── Vendor reliability ───────────────────────────────────────────────────────


class VendorHistory(BaseModel):
    vendor_id: str = Field(min_length=1)
    answered: int = Field(ge=0)
    declined: int = Field(ge=0)
    expired: int = Field(ge=0)
    avg_reply_min: float = Field(default=0, ge=0)

    @model_validator(mode="after")
    def counts(self) -> "VendorHistory":
        if self.declined > self.answered:
            raise ValueError("declined can't exceed answered")
        return self


class ReliabilityRequest(BaseModel):
    vendors: list[VendorHistory] = Field(min_length=1, max_length=500)


class Reliability(BaseModel):
    vendor_id: str
    failure_probability: float
    interval_90: tuple[float, float]
    evidence: int
    needs_backup: bool
    explanation: str


class ReliabilityResponse(BaseModel):
    vendors: list[Reliability]
    metadata: dict
