"""Async HTTP client wrapping Ollama REST endpoints (/api/tags, /api/embed, /api/chat)."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx


class OllamaUnavailableError(RuntimeError):
    """Raised on network failures, HTTP 5xx, missing model, or timeouts (mapped to HTTP 503/504)."""

    def __init__(self, message: str, *, is_timeout: bool = False) -> None:
        super().__init__(message)
        self.is_timeout = is_timeout


class OllamaBadOutputError(ValueError):
    """Raised when Ollama returns text that cannot be decoded into a JSON object."""


def _strip_thinking_and_fences(raw_text: str) -> str:
    cleaned = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL | re.IGNORECASE).strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, flags=re.DOTALL | re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    return cleaned


def parse_json_object(raw_text: str) -> dict[str, Any]:
    """Extract and parse a JSON object from LLM response content."""
    cleaned = _strip_thinking_and_fences(raw_text)
    if not cleaned:
        raise OllamaBadOutputError("Ollama returned an empty response.")

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            parsed = json.loads(cleaned[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError as exc:
            raise OllamaBadOutputError("Ollama output is not valid JSON.") from exc

    raise OllamaBadOutputError("Ollama output did not contain a JSON object.")


class OllamaClient:
    """Pooled async HTTP client for local or remote Ollama daemon."""

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        embed_model: str = "",
        keep_alive: str = "15m",
        temperature: float = 0.25,
        num_ctx: int = 8192,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._embed_model = embed_model.strip()
        self._keep_alive = keep_alive
        self._temperature = temperature
        self._num_ctx = num_ctx
        self._owns_client = http_client is None
        self._client = http_client or httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0),
        )

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    @staticmethod
    def _matches_model_name(configured: str, available: list[str]) -> bool:
        target = configured.strip().lower()
        if not target:
            return False
        for name in available:
            norm = name.strip().lower()
            if norm == target or norm.split(":")[0] == target and ":" not in target:
                return True
        return False

    async def health(self) -> dict[str, Any]:
        """Query Ollama /api/tags to verify daemon reachability and model availability."""
        try:
            resp = await self._client.get("/api/tags", timeout=5.0)
            resp.raise_for_status()
            data = resp.json()
            models = [m.get("name", "") for m in data.get("models", []) if isinstance(m, dict)]
            ready = self._matches_model_name(self._model, models)
            return {
                "ollama_reachable": True,
                "model": self._model,
                "model_ready": ready,
                "available_models": models,
            }
        except Exception as exc:
            return {
                "ollama_reachable": False,
                "model": self._model,
                "model_ready": False,
                "available_models": [],
                "error": type(exc).__name__,
            }

    async def embed_texts(self, texts: list[str], *, timeout_seconds: float = 20.0) -> list[list[float]] | None:
        """Compute embeddings via Ollama /api/embed if an embedding model is configured."""
        if not self._embed_model or not texts:
            return None
        try:
            resp = await self._client.post(
                "/api/embed",
                json={"model": self._embed_model, "input": texts, "keep_alive": self._keep_alive},
                timeout=timeout_seconds,
            )
            resp.raise_for_status()
            data = resp.json()
            embeddings = data.get("embeddings")
            if isinstance(embeddings, list) and len(embeddings) == len(texts):
                return embeddings
            return None
        except Exception:
            return None

    async def chat_json(
        self,
        *,
        messages: list[dict[str, str]],
        json_schema: dict[str, Any],
        timeout_seconds: float,
    ) -> tuple[dict[str, Any], str]:
        """Execute non-streaming structured chat completion and return parsed dict + raw string."""
        payload = {
            "model": self._model,
            "messages": messages,
            "stream": False,
            "think": False,
            "keep_alive": self._keep_alive,
            "format": json_schema,
            "options": {
                "temperature": self._temperature,
                "num_ctx": self._num_ctx,
            },
        }
        try:
            resp = await self._client.post(
                "/api/chat",
                json=payload,
                timeout=max(5.0, float(timeout_seconds)),
            )
        except httpx.TimeoutException as exc:
            raise OllamaUnavailableError("Ollama inference timed out.", is_timeout=True) from exc
        except httpx.RequestError as exc:
            raise OllamaUnavailableError(f"Cannot reach Ollama server: {type(exc).__name__}") from exc

        if resp.status_code == 404:
            raise OllamaUnavailableError(f"Ollama model '{self._model}' not found.")
        if resp.status_code >= 500 or resp.status_code == 429:
            raise OllamaUnavailableError(f"Ollama returned HTTP {resp.status_code}.")
        if resp.status_code >= 400:
            raise OllamaBadOutputError(f"Ollama rejected request with HTTP {resp.status_code}.")

        try:
            body = resp.json()
        except ValueError as exc:
            raise OllamaBadOutputError("Invalid JSON envelope from Ollama.") from exc

        raw_content = ""
        message = body.get("message")
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            raw_content = message["content"]
        elif isinstance(body.get("response"), str):
            raw_content = body["response"]

        return parse_json_object(raw_content), raw_content
