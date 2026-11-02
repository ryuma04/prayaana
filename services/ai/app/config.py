"""Settings for the AI agent layer. Everything comes from the environment (the same variable names
the Go backend reads from backend/.env), and no value is ever logged or returned by the API."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass


def _clean(v: str) -> str:
    return v.strip().strip('"').strip("'").strip()


def keys(*names: str) -> list[str]:
    """NAME, NAMES (comma-separated) and NAME_1..NAME_9, like backend/internal/config.keys."""
    out: list[str] = []

    def add(value: str | None) -> None:
        for k in (value or "").split(","):
            k = _clean(k)
            if k and k not in out:
                out.append(k)

    for n in names:
        add(os.getenv(n))
        add(os.getenv(n + "S"))
        for i in range(1, 10):
            add(os.getenv(f"{n}_{i}"))
    return out


def first(default: str, *names: str) -> str:
    for n in names:
        v = _clean(os.getenv(n, ""))
        if v:
            return v
    return default


def seconds(value: str, default: float) -> float:
    """Parses Go-style durations ("12s", "1500ms", "1m") or plain seconds."""
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(ms|s|m)?\s*", value or "")
    if not m:
        return default
    n, unit = float(m.group(1)), m.group(2) or "s"
    return n / 1000 if unit == "ms" else n * 60 if unit == "m" else n


@dataclass(frozen=True)
class Settings:
    groq_keys: tuple[str, ...]
    groq_base_url: str
    groq_model: str
    gemini_keys: tuple[str, ...]
    gemini_base_url: str
    gemini_model: str
    llm_timeout_s: float
    llm_enabled: bool

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            groq_keys=tuple(keys("GROQ_API_KEY", "GROQ_KEY")),
            groq_base_url=first("https://api.groq.com/openai/v1", "GROQ_BASE_URL", "GROQ_URL").rstrip("/"),
            groq_model=first("openai/gpt-oss-120b", "AGENT_GROQ_MODEL", "GROQ_AGENT_MODEL", "GROQ_MODEL"),
            gemini_keys=tuple(keys("GEMINI_API_KEY", "GEMINI_KEY", "GOOGLE_API_KEY")),
            gemini_base_url=first("https://generativelanguage.googleapis.com/v1beta", "GEMINI_BASE_URL", "GEMINI_URL").rstrip("/"),
            gemini_model=first("gemini-3.8-flash", "AGENT_GEMINI_MODEL", "GEMINI_MODEL"),
            llm_timeout_s=seconds(first("12s", "AGENT_LLM_TIMEOUT", "AI_TIMEOUT"), 12.0),
            # AGENT_LLM=0 keeps the agent on its rules (tests, offline demos).
            llm_enabled=first("1", "AGENT_LLM") not in ("0", "false", "off", "no"),
        )
