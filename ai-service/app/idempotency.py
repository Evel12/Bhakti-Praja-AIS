"""In-memory async idempotency store keyed by Idempotency-Key header."""

from __future__ import annotations

import asyncio
import hashlib
import time
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class CachedResponse:
    """Stored response tied to a specific request fingerprint and expiry timestamp."""

    fingerprint: str
    payload: dict[str, Any]
    expires_at: float


class IdempotencyConflictError(Exception):
    """Raised when an Idempotency-Key is reused with a different request payload."""


class IdempotencyStore:
    """Coordinates concurrent retries sharing an Idempotency-Key without double-running Ollama."""

    def __init__(self, ttl_seconds: int = 900) -> None:
        self._ttl_seconds = ttl_seconds
        self._entries: dict[str, CachedResponse] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._guard = asyncio.Lock()

    @staticmethod
    def build_fingerprint(pdf_bytes: bytes, question_count: int, language: str) -> str:
        """Compute deterministic SHA-256 fingerprint for multipart inputs."""
        hasher = hashlib.sha256()
        hasher.update(str(question_count).encode("utf-8"))
        hasher.update(b":")
        hasher.update(language.strip().lower().encode("utf-8"))
        hasher.update(b":")
        hasher.update(pdf_bytes)
        return hasher.hexdigest()

    async def lock_for(self, key: str) -> asyncio.Lock:
        """Return a stable asyncio Lock per idempotency key."""
        async with self._guard:
            lock = self._locks.get(key)
            if lock is None:
                lock = asyncio.Lock()
                self._locks[key] = lock
            return lock

    async def get(self, key: str, fingerprint: str) -> dict[str, Any] | None:
        """Return cached response payload if present and unexpired, or raise on payload mismatch."""
        async with self._guard:
            self._prune_expired_locked()
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.fingerprint != fingerprint:
                raise IdempotencyConflictError(
                    "Idempotency-Key already used with different request inputs."
                )
            return entry.payload

    async def put(self, key: str, fingerprint: str, payload: dict[str, Any]) -> None:
        """Persist a completed response under the idempotency key."""
        async with self._guard:
            self._prune_expired_locked()
            self._entries[key] = CachedResponse(
                fingerprint=fingerprint,
                payload=payload,
                expires_at=time.monotonic() + self._ttl_seconds,
            )

    def _prune_expired_locked(self) -> None:
        now = time.monotonic()
        expired = [k for k, v in self._entries.items() if v.expires_at <= now]
        for key in expired:
            self._entries.pop(key, None)
            lock = self._locks.get(key)
            if lock is not None and not lock.locked():
                self._locks.pop(key, None)
