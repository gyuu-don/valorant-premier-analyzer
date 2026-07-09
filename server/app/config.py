"""Application configuration and tunable analytics constants.

Loaded from environment variables (and a repo-root .env file) via pydantic-settings.
Metric weights and windows live here so coaching definitions can be tuned without
touching the analytics code.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# .env lives at the repo root (one level above server/)
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore"
    )

    # HenrikDev API
    henrik_api_key: str = Field(default="", alias="HENRIK_API_KEY")
    henrik_base_url: str = "https://api.henrikdev.xyz"

    # Target Premier team
    premier_team_name: str = Field(default="", alias="PREMIER_TEAM_NAME")
    premier_team_tag: str = Field(default="", alias="PREMIER_TEAM_TAG")
    premier_region: str = Field(default="na", alias="PREMIER_REGION")

    # Server
    port: int = Field(default=8000, alias="PORT")
    cors_origins: str = Field(
        default="http://localhost:5173", alias="CORS_ORIGINS"
    )

    # Analysis tuning
    max_matches: int = Field(default=25, alias="MAX_MATCHES")
    trade_window_ms: int = Field(default=4000, alias="TRADE_WINDOW_MS")

    # Cache TTLs (seconds)
    match_cache_ttl: int = 60 * 60 * 24  # match detail is immutable
    team_cache_ttl: int = 60 * 10

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def has_team_config(self) -> bool:
        return bool(self.premier_team_name and self.premier_team_tag)


# ---------------------------------------------------------------------------
# Advanced-MVP impact-rating weights.
# Each component is normalized to a 0..1 scale within the team before weighting,
# then scaled to a 0..100 rating. Weights need not sum to 1 (they are re-normalized
# in mvp.py), but keeping them ~1.0 makes them easy to reason about.
# ---------------------------------------------------------------------------
MVP_WEIGHTS: dict[str, float] = {
    "acs": 0.30,            # average combat score per round
    "kast": 0.20,          # kill/assist/survive/trade consistency
    "entry_win_rate": 0.15,  # opening-duel success
    "trade_contribution": 0.10,  # trades secured minus own untraded deaths
    "multikills": 0.10,    # 2k+ rounds
    "clutches": 0.10,      # last-alive round wins
    "adr": 0.05,           # average damage per round
}


@lru_cache
def get_settings() -> Settings:
    return Settings()
