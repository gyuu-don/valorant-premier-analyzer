"""Match endpoints: enriched match list for the picker + raw match detail (v4)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.analytics.report import build_match_summaries
from app.config import get_settings
from app.henrik import endpoints
from app.henrik.client import HenrikError

router = APIRouter(prefix="/api", tags=["match"])


@router.get("/matches")
async def list_matches(
    name: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=25),
):
    """Paginated, latest-first match summaries (date, map, opponent, result, score).

    Returns `has_more` so the client can lazy-load additional pages (infinite scroll).
    """
    settings = get_settings()
    name = name or settings.premier_team_name
    tag = tag or settings.premier_team_tag
    if not name or not tag:
        raise HTTPException(status_code=400, detail="No team configured (set PREMIER_TEAM_* or pass ?name=&tag=).")
    try:
        team = await endpoints.get_team(name, tag)
        matches, has_more, total = await endpoints.load_match_page(team, offset, limit)
    except HenrikError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    # next_offset advances by history *entries* consumed (not summaries returned), so
    # paging stays aligned even when some matches are skipped (failed to load / not analyzable).
    next_offset = min(offset + limit, total)
    return {
        "matches": build_match_summaries(team, matches),
        "offset": offset,
        "next_offset": next_offset,
        "has_more": has_more,
        "total": total,
    }


@router.get("/match/{match_id}")
async def get_match(match_id: str, region: str | None = None):
    region = region or get_settings().premier_region
    try:
        match = await endpoints.get_match(region, match_id)
    except HenrikError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return match.model_dump()
