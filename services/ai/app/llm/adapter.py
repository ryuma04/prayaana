"""LLM adapter for the AI agent: Groq first, Gemini as backup, strict JSON validated with pydantic.

It mirrors the Go gateway (backend/internal/ai): same providers, same environment keys, the same
cool-down after rate limits or bad keys. Keys stay in memory only; errors and logs name the provider
and HTTP status, never the key or the provider's response body.
"""
from __future__ import annotations

import json
import logging
import threading
import time
from typing import Protocol, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from ..config import Settings

log = logging.getLogger("ai.llm")
T = TypeVar("T", bound=BaseModel)


class LLMUnavailable(Exception):
    """No provider could give a valid answer (none configured, all cooling down, or all failed)."""


class ProviderError(Exception):
    def __init__(self, provider: str, status: int, cooldown_s: float):
        super().__init__(f"{provider} failed (status {status})")
        self.status, self.cooldown_s = status, cooldown_s


def cooldown_for(status: int) -> float:
    if status == 429:
        return 60
    if status in (401, 403):
        return 600
    if status >= 500 or status == 0:
        return 20
    return 0


class Keyring:
    """Rotates keys and skips a key for a while after it is rate-limited or rejected."""

    def __init__(self, keys: tuple[str, ...] | list[str]):
        self._keys = list(keys)
        self._until: dict[int, float] = {}
        self._lock = threading.Lock()

    def __len__(self) -> int:
        return len(self._keys)

    def available(self) -> list[tuple[int, str]]:
        now = time.monotonic()
        with self._lock:
            return [(i, k) for i, k in enumerate(self._keys) if self._until.get(i, 0) <= now]

    def cool(self, index: int, seconds: float) -> None:
        if seconds > 0:
            with self._lock:
                self._until[index] = time.monotonic() + seconds


def parse_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        t = t[4:] if t.lower().startswith("json") else t
    start = t.find("{")
    end = t.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no JSON object in the answer")
    return json.loads(t[start:end + 1])


class Provider(Protocol):
    name: str

    def complete_json(self, system: str, user: str) -> dict: ...


class _HTTPProvider:
    name = "provider"

    def __init__(self, keys: tuple[str, ...], base: str, model: str, client: httpx.Client):
        self.ring, self.base, self.model, self.client = Keyring(keys), base, model, client

    def _request(self, key: str, system: str, user: str) -> httpx.Response:  # pragma: no cover - overridden
        raise NotImplementedError

    def _text(self, data: dict) -> str:  # pragma: no cover - overridden
        raise NotImplementedError

    def complete_json(self, system: str, user: str) -> dict:
        last: ProviderError | None = None
        for index, key in self.ring.available():
            try:
                resp = self._request(key, system, user)
            except httpx.HTTPError:
                last = ProviderError(self.name, 0, cooldown_for(0))
                self.ring.cool(index, 10)
                continue
            if resp.status_code >= 300:
                last = ProviderError(self.name, resp.status_code, cooldown_for(resp.status_code))
                self.ring.cool(index, last.cooldown_s)
                log.warning("llm provider failed provider=%s status=%s", self.name, resp.status_code)
                continue
            try:
                return parse_json(self._text(resp.json()))
            except (ValueError, KeyError, IndexError, TypeError):
                last = ProviderError(self.name, 200, 0)
                log.warning("llm provider returned unusable JSON provider=%s", self.name)
                continue
        raise last or ProviderError(self.name, 0, 0)


class Groq(_HTTPProvider):
    name = "groq"

    def _request(self, key: str, system: str, user: str) -> httpx.Response:
        body = {"model": self.model, "temperature": 0, "max_completion_tokens": 1200, "response_format": {"type": "json_object"},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        if "gpt-oss" in self.model:
            body["reasoning_effort"] = "low"
        resp = self.client.post(f"{self.base}/chat/completions", json=body, headers={"Authorization": f"Bearer {key}"})
        if resp.status_code == 400 and "reasoning_effort" in resp.text:
            body.pop("reasoning_effort", None)
            resp = self.client.post(f"{self.base}/chat/completions", json=body, headers={"Authorization": f"Bearer {key}"})
        return resp

    def _text(self, data: dict) -> str:
        return data["choices"][0]["message"]["content"]


class Gemini(_HTTPProvider):
    name = "gemini"

    def _request(self, key: str, system: str, user: str) -> httpx.Response:
        body = {"systemInstruction": {"parts": [{"text": system}]}, "contents": [{"role": "user", "parts": [{"text": user}]}],
                "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "maxOutputTokens": 1200}}
        return self.client.post(f"{self.base}/models/{self.model}:generateContent", json=body, headers={"x-goog-api-key": key})

    def _text(self, data: dict) -> str:
        return "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])


class LLM:
    def __init__(self, providers: list[Provider]):
        self.providers = providers

    @classmethod
    def from_settings(cls, s: Settings, client: httpx.Client | None = None) -> "LLM":
        if not s.llm_enabled:
            return cls([])
        client = client or httpx.Client(timeout=s.llm_timeout_s)
        providers: list[Provider] = []
        if s.groq_keys:
            providers.append(Groq(s.groq_keys, s.groq_base_url, s.groq_model, client))
        if s.gemini_keys:
            providers.append(Gemini(s.gemini_keys, s.gemini_base_url, s.gemini_model, client))
        return cls(providers)

    @property
    def enabled(self) -> bool:
        return bool(self.providers)

    @property
    def engines(self) -> list[str]:
        return [p.name for p in self.providers]

    def structured(self, system: str, user: str, model: type[T]) -> tuple[T, str]:
        """Asks each provider in turn for JSON matching `model`; returns it with the provider's name."""
        for p in self.providers:
            try:
                raw = p.complete_json(system, user)
                return model.model_validate(raw), p.name
            except ProviderError:
                continue
            except ValidationError:
                log.warning("llm answer failed validation provider=%s", p.name)
                continue
        raise LLMUnavailable("no language model gave a valid answer")
