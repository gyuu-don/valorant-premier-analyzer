"""Team endpoints: configured team details/roster and Premier match history."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.henrik import endpoints
from app.henrik.client import HenrikError

router = APIRouter(prefix="/api", tags=["team"])


@router.get("/team")
async def get_team(
    name: str | None = Query(default=None),
    tag: str | None = Query(default=None),
):
    settings = get_settings()
    name = name or settings.premier_team_name
    tag = tag or settings.premier_team_tag
    if not name or not tag:
        raise HTTPException(
            status_code=400,
            detail="No team configured. Set PREMIER_TEAM_NAME/PREMIER_TEAM_TAG in .env "
            "or pass ?name=&tag=.",
        )
    try:
        team = await endpoints.get_team(name, tag)
    except HenrikError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return team.model_dump()


@router.get("/team/history")
async def get_team_history(
    name: str | None = Query(default=None),
    tag: str | None = Query(default=None),
):
    settings = get_settings()
    name = name or settings.premier_team_name
    tag = tag or settings.premier_team_tag
    try:
        team = await endpoints.get_team(name, tag)
        if not team.id:
            raise HTTPException(status_code=404, detail="Team has no id; cannot fetch history.")
        history = await endpoints.get_team_history(team.id)
    except HenrikError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return {"team_id": team.id, "history": [h.model_dump() for h in history]}
