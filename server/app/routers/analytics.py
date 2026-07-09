"""Analytics endpoint: the full season report for the configured (or queried) team."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.analytics.report import build_report
from app.config import get_settings
from app.henrik import endpoints
from app.henrik.client import HenrikError

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/report")
async def get_report(
    name: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=100),
    season: str | None = Query(default=None, description="Premier stage id to filter by"),
):
    settings = get_settings()
    name = name or settings.premier_team_name
    tag = tag or settings.premier_team_tag
    # A stage is bounded and small, so pull enough to cover the whole stage when filtering.
    limit = limit or (100 if season else settings.max_matches)
    if not name or not tag:
        raise HTTPException(
            status_code=400,
            detail="No team configured. Set PREMIER_TEAM_NAME/PREMIER_TEAM_TAG in .env "
            "or pass ?name=&tag=.",
        )
    try:
        team = await endpoints.get_team(name, tag)
        matches = await endpoints.load_recent_matches(team, limit, season_id=season)
    except HenrikError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return build_report(team, matches)
