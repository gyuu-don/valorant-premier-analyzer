"""Typed wrappers around the HenrikDev Premier + match endpoints.

Endpoint reference: https://docs.henrikdev.xyz/valorant/api-reference/premier
Responses are wrapped as {"status": int, "data": ...}; helpers unwrap `data`.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from app.cache import cache
from app.config import get_settings
from app.henrik.client import client
from app.models import MatchV4, PremierHistoryEntry, PremierTeam


def _unwrap(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


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


async def get_premier_seasons(region: Optional[str] = None) -> list[dict]:
    """GET /valorant/v1/premier/seasons/{region} -> stage windows (id, starts_at, ends_at)."""
    settings = get_settings()
    region = region or settings.premier_region
    key = f"seasons:{region}"

    async def factory() -> Any:
        return _unwrap(await client.get(f"/valorant/v1/premier/seasons/{region}"))

    data = await cache.get_or_set(key, settings.team_cache_ttl, factory)
    return data or []


async def _season_window(
    season_id: str, region: Optional[str] = None
) -> Optional[tuple[datetime, datetime]]:
    """Official [start, end] window for a Premier stage id."""
    for s in await get_premier_seasons(region):
        if s.get("id") == season_id:
            start, end = _parse_dt(s.get("starts_at")), _parse_dt(s.get("ends_at"))
            if start and end and start.year > 1:
                return start, end
    return None


async def _sorted_history(team: PremierTeam, season_id: Optional[str] = None):
    """History entries (resolvable id), sorted most-recent first, optionally filtered
    to a single Premier stage by its date window."""
    history = await get_team_history(team.id) if team.id else []
    entries = [h for h in history if h.resolved_match_id]
    if season_id:
        window = await _season_window(season_id)
        if window:
            start, end = window
            entries = [
                h
                for h in entries
                if (d := _parse_dt(h.started_at)) is not None and start <= d <= end
            ]
    entries.sort(key=lambda h: h.started_at or "", reverse=True)
    return entries


async def _load_ids(match_ids: list[str], region: str) -> list[MatchV4]:
    matches: list[MatchV4] = []
    for mid in match_ids:
        try:
            matches.append(await get_match(region, mid))
        except Exception:
            # Skip individual matches that fail to load rather than failing the batch.
            continue
    return matches


async def load_recent_matches(
    team: PremierTeam, limit: int, region: Optional[str] = None, season_id: Optional[str] = None
) -> list[MatchV4]:
    """Resolve a team's most-recent Premier match IDs into full match details."""
    settings = get_settings()
    region = region or settings.premier_region
    entries = await _sorted_history(team, season_id)
    return await _load_ids([h.resolved_match_id for h in entries[:limit]], region)


async def load_match_page(
    team: PremierTeam,
    offset: int,
    limit: int,
    region: Optional[str] = None,
    season_id: Optional[str] = None,
) -> tuple[list[MatchV4], bool, int]:
    """A page of match details (most-recent first) plus (has_more, total) for infinite scroll."""
    settings = get_settings()
    region = region or settings.premier_region
    entries = await _sorted_history(team, season_id)
    total = len(entries)
    page_ids = [h.resolved_match_id for h in entries[offset : offset + limit]]
    matches = await _load_ids(page_ids, region)
    return matches, offset + limit < total, total


async def build_stages(team: PremierTeam, region: Optional[str] = None) -> list[dict]:
    """Premier stages the team has matches in: id, short code, date window, match count.

    Windows come from the official seasons endpoint; the short code (e.g. "e11a3") is read
    from the latest match in each stage. Sorted most-recent stage first.
    """
    settings = get_settings()
    region = region or settings.premier_region
    seasons = await get_premier_seasons(region)
    windows = []
    for s in seasons:
        start, end = _parse_dt(s.get("starts_at")), _parse_dt(s.get("ends_at"))
        if s.get("id") and start and end and start.year > 1:
            windows.append((s["id"], start, end))

    entries = await _sorted_history(team)  # most-recent first
    stages: dict[str, dict] = {}
    for h in entries:
        d = _parse_dt(h.started_at)
        if d is None:
            continue
        for sid, start, end in windows:
            if start <= d <= end:
                st = stages.setdefault(
                    sid,
                    {"id": sid, "short": None, "starts_at": start.isoformat(),
                     "ends_at": end.isoformat(), "matches": 0, "_latest_mid": h.resolved_match_id},
                )
                st["matches"] += 1  # entries are desc, so first seen is the latest
                break

    # Fetch the short code for each stage from its most-recent match.
    for st in stages.values():
        try:
            m = await get_match(region, st.pop("_latest_mid"))
            st["short"] = m.metadata.season.short
        except Exception:
            st.pop("_latest_mid", None)

    return sorted(stages.values(), key=lambda s: s["starts_at"], reverse=True)
