"""A tiny in-memory async TTL cache.

Match details are immutable once a game ends, so they are cached aggressively to stay
within the HenrikDev free-tier rate limits and to make repeated report loads fast.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, Awaitable, Callable, Optional


class TTLCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    def get(self, key: str) -> Optional[Any]:
        item = self._store.get(key)
        if item is None:
            return None
        expires_at, value = item
        if time.monotonic() > expires_at:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, ttl: int) -> None:
        self._store[key] = (time.monotonic() + ttl, value)

    async def get_or_set(
        self, key: str, ttl: int, factory: Callable[[], Awaitable[Any]]
    ) -> Any:
        cached = self.get(key)
        if cached is not None:
            return cached
        # Serialize misses so a burst of identical requests only fetches once.
        async with self._lock:
            cached = self.get(key)
            if cached is not None:
                return cached
            value = await factory()
            self.set(key, value, ttl)
            return value


cache = TTLCache()
