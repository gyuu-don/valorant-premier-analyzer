"""Raw match detail passthrough (v4)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.henrik import endpoints
from app.henrik.client import HenrikError

router = APIRouter(prefix="/api", tags=["match"])


@router.get("/match/{match_id}")
async def get_match(match_id: str, region: str | None = None):
    region = region or get_settings().premier_region
    try:
        match = await endpoints.get_match(region, match_id)
    except HenrikError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return match.model_dump()
