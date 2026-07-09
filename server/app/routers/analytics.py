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
    limit: int | None = Query(default=None, ge=1, le=50),
):
    settings = get_settings()
    name = name or settings.premier_team_name
    tag = tag or settings.premier_team_tag
    limit = limit or settings.max_matches
    if not name or not tag:
        raise HTTPException(
            status_code=400,
            detail="No team configured. Set PREMIER_TEAM_NAME/PREMIER_TEAM_TAG in .env "
            "or pass ?name=&tag=.",
        )
    try:
        team = await endpoints.get_team(name, tag)
        matches = await endpoints.load_recent_matches(team, limit)
    except HenrikError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return build_report(team, matches)
