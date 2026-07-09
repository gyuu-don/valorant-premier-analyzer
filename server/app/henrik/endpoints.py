"""Typed wrappers around the HenrikDev Premier + match endpoints.

Endpoint reference: https://docs.henrikdev.xyz/valorant/api-reference/premier
Responses are wrapped as {"status": int, "data": ...}; helpers unwrap `data`.
"""
from __future__ import annotations

from typing import Any, Optional

from app.cache import cache
from app.config import get_settings
from app.henrik.client import client
from app.models import MatchV4, PremierHistoryEntry, PremierTeam


def _unwrap(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload


async def get_team(name: str, tag: str) -> PremierTeam:
    """GET /valorant/v1/premier/{name}/{tag} -> team details + roster."""
    settings = get_settings()
    key = f"team:{name}:{tag}"

    async def factory() -> dict[str, Any]:
        return _unwrap(await client.get(f"/valorant/v1/premier/{name}/{tag}"))

    data = await cache.get_or_set(key, settings.team_cache_ttl, factory)
    return PremierTeam.model_validate(data)


async def get_team_history(team_id: str) -> list[PremierHistoryEntry]:
    """GET /valorant/v1/premier/{team_id}/history -> list of past matches."""
    settings = get_settings()
    key = f"history:{team_id}"

    async def factory() -> Any:
        return _unwrap(await client.get(f"/valorant/v1/premier/{team_id}/history"))

    data = await cache.get_or_set(key, settings.team_cache_ttl, factory)
    # Some responses nest under {"league_matches": [...]}; handle both.
    if isinstance(data, dict):
        data = data.get("league_matches") or data.get("matches") or []
    return [PremierHistoryEntry.model_validate(m) for m in data or []]


async def get_match(region: str, match_id: str) -> MatchV4:
    """GET /valorant/v4/match/{region}/{matchid} -> full match detail (cached hard)."""
    settings = get_settings()
    key = f"match:{region}:{match_id}"

    async def factory() -> dict[str, Any]:
        return _unwrap(await client.get(f"/valorant/v4/match/{region}/{match_id}"))

    data = await cache.get_or_set(key, settings.match_cache_ttl, factory)
    return MatchV4.parse(data)


async def get_configured_team() -> PremierTeam:
    settings = get_settings()
    return await get_team(settings.premier_team_name, settings.premier_team_tag)


async def load_recent_matches(
    team: PremierTeam, limit: int, region: Optional[str] = None
) -> list[MatchV4]:
    """Resolve a team's recent Premier match IDs into full match details."""
    settings = get_settings()
    region = region or settings.premier_region
    history = await get_team_history(team.id) if team.id else []
    match_ids = [h.resolved_match_id for h in history if h.resolved_match_id]
    match_ids = match_ids[:limit]

    matches: list[MatchV4] = []
    for mid in match_ids:
        try:
            matches.append(await get_match(region, mid))
        except Exception:
            # Skip individual matches that fail to load rather than failing the report.
            continue
    return matches
