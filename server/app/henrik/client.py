"""Thin async HTTP client for the HenrikDev API.

Responsibilities:
- attach the API key header
- centralize base URL
- handle 429 rate limiting with backoff (honoring Retry-After when present)
- surface clean errors to the routers
"""
from __future__ import annotations

import asyncio
from typing import Any, Optional

import httpx

from app.config import get_settings


class HenrikError(Exception):
    """Raised when the HenrikDev API returns an unrecoverable error."""

    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(f"HenrikDev API error {status_code}: {message}")


class HenrikClient:
    def __init__(self, max_retries: int = 3) -> None:
        settings = get_settings()
        self._base_url = settings.henrik_base_url
        self._headers = {"Authorization": settings.henrik_api_key}
        self._max_retries = max_retries
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                headers=self._headers,
                timeout=httpx.Timeout(20.0),
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def get(self, path: str, params: Optional[dict[str, Any]] = None) -> Any:
        client = await self._get_client()
        backoff = 1.0
        last_error: Optional[str] = None

        for attempt in range(self._max_retries + 1):
            try:
                resp = await client.get(path, params=params)
            except httpx.RequestError as exc:  # network/timeout
                last_error = str(exc)
                if attempt == self._max_retries:
                    raise HenrikError(503, f"request failed: {exc}") from exc
                await asyncio.sleep(backoff)
                backoff *= 2
                continue

            if resp.status_code == 429:
                retry_after = float(resp.headers.get("Retry-After", backoff))
                if attempt == self._max_retries:
                    raise HenrikError(429, "rate limited by HenrikDev API")
                await asyncio.sleep(retry_after)
                backoff *= 2
                continue

            if resp.status_code == 404:
                raise HenrikError(404, "resource not found (check team name/tag/region)")

            if resp.status_code >= 400:
                raise HenrikError(resp.status_code, resp.text[:300])

            return resp.json()

        raise HenrikError(503, last_error or "unknown error")


# A single shared client instance for the app lifetime.
client = HenrikClient()
