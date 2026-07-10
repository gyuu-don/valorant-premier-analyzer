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

    # Discord poll planning
    discord_bot_token: str = Field(default="", alias="DISCORD_BOT_TOKEN")
    discord_channel_id: str = Field(default="", alias="DISCORD_CHANNEL_ID")
    discord_guild_id: str = Field(default="", alias="DISCORD_GUILD_ID")
    discord_poll_scan_limit: int = Field(default=500, alias="DISCORD_POLL_SCAN_LIMIT")

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
# Ordered greatest → least; this order also drives the display order of the component
# breakdown everywhere (the client iterates the weights object's keys).
MVP_WEIGHTS: dict[str, float] = {
    "kast": 0.22,                # kill/assist/survive/trade consistency
    "entry_win_rate": 0.18,      # opening-duel success
    "adr": 0.15,                 # average damage per round
    "trade_contribution": 0.15,  # trades secured minus own untraded deaths
    "multikills": 0.10,          # 2k+ rounds
    "clutches": 0.10,            # last-alive round wins
    "acs": 0.10,                 # average combat score per round
}


@lru_cache
def get_settings() -> Settings:
    return Settings()
