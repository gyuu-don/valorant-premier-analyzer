"""Premier stages the team has played in — powers the global stage filter dropdown."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.henrik import endpoints
from app.henrik.client import HenrikError

router = APIRouter(prefix="/api", tags=["stages"])


@router.get("/stages")
async def list_stages(
    name: str | None = Query(default=None),
    tag: str | None = Query(default=None),
):
    settings = get_settings()
    name = name or settings.premier_team_name
    tag = tag or settings.premier_team_tag
    if not name or not tag:
        raise HTTPException(status_code=400, detail="No team configured (set PREMIER_TEAM_* or pass ?name=&tag=).")
    try:
        team = await endpoints.get_team(name, tag)
        stages = await endpoints.build_stages(team)
    except HenrikError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return {"stages": stages}
