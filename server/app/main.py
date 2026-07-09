"""FastAPI application entrypoint.

Run from the server/ directory:
    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.henrik.client import client
from app.routers import analytics, match, stages, team

# Built frontend (client/dist), present in production/Docker; absent during local API-only dev.
DIST = Path(__file__).resolve().parents[2] / "client" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await client.close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Valorant Premier Team Analyzer",
        description="Analyze a Valorant Premier team's match performance (HenrikDev API).",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    app.include_router(team.router)
    app.include_router(match.router)
    app.include_router(analytics.router)
    app.include_router(stages.router)

    @app.get("/api/health")
    async def health() -> dict:
        return {
            "status": "ok",
            "team_configured": settings.has_team_config,
            "api_key_present": bool(settings.henrik_api_key),
        }

    # Serve the built SPA (same origin as the API) when a production build exists.
    if DIST.is_dir():
        app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

        @app.get("/{path:path}")
        async def spa(path: str) -> FileResponse:
            if path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not found")
            candidate = DIST / path
            if path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(DIST / "index.html")  # SPA fallback (client-side routing)

    return app


app = create_app()
