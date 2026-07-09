"""Pydantic models for the HenrikDev v4 match payload and Premier responses.

These are intentionally *defensive*: `extra="ignore"` and optional fields mean that
minor schema drift in the unofficial API will not crash parsing. The analytics engine
keys off these normalized models, so this is the single place to adjust if HenrikDev
changes field names. Confirm against a live sample (or api.henrikdev.xyz/docs) on first run.
"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


# --------------------------------------------------------------------------- #
# Match metadata
# --------------------------------------------------------------------------- #
class MapInfo(_Base):
    id: Optional[str] = None
    name: Optional[str] = None


class QueueInfo(_Base):
    id: Optional[str] = None
    name: Optional[str] = None
    mode_type: Optional[str] = None


class SeasonInfo(_Base):
    id: Optional[str] = None
    short: Optional[str] = None


class MatchMetadata(_Base):
    match_id: Optional[str] = None
    map: MapInfo = Field(default_factory=MapInfo)
    started_at: Optional[str] = None
    game_length_in_ms: Optional[int] = None
    queue: QueueInfo = Field(default_factory=QueueInfo)
    season: SeasonInfo = Field(default_factory=SeasonInfo)
    region: Optional[str] = None

    @property
    def map_name(self) -> str:
        return self.map.name or "Unknown"


# --------------------------------------------------------------------------- #
# Players
# --------------------------------------------------------------------------- #
class AgentInfo(_Base):
    id: Optional[str] = None
    name: Optional[str] = None


class DamageTotals(_Base):
    dealt: int = 0
    received: int = 0


class PlayerStats(_Base):
    score: int = 0
    kills: int = 0
    deaths: int = 0
    assists: int = 0
    headshots: int = 0
    bodyshots: int = 0
    legshots: int = 0
    damage: DamageTotals = Field(default_factory=DamageTotals)


class AbilityCasts(_Base):
    grenade: int = 0
    ability1: int = 0
    ability2: int = 0
    ultimate: int = 0

    @property
    def total(self) -> int:
        return self.grenade + self.ability1 + self.ability2 + self.ultimate


class MatchPlayer(_Base):
    puuid: Optional[str] = None
    name: Optional[str] = None
    tag: Optional[str] = None
    team_id: Optional[str] = Field(default=None, alias="team_id")
    agent: AgentInfo = Field(default_factory=AgentInfo)
    stats: PlayerStats = Field(default_factory=PlayerStats)
    ability_casts: AbilityCasts = Field(default_factory=AbilityCasts)

    @property
    def display_name(self) -> str:
        if self.name and self.tag:
            return f"{self.name}#{self.tag}"
        return self.name or self.puuid or "Unknown"


# --------------------------------------------------------------------------- #
# Teams
# --------------------------------------------------------------------------- #
class TeamRoundRecord(_Base):
    won: int = 0
    lost: int = 0


class PremierRosterInMatch(_Base):
    """The Premier team snapshot embedded on each match team (v4)."""

    id: Optional[str] = None
    name: Optional[str] = None
    tag: Optional[str] = None
    members: list[str] = Field(default_factory=list)


class MatchTeam(_Base):
    team_id: Optional[str] = None
    won: bool = False
    rounds: TeamRoundRecord = Field(default_factory=TeamRoundRecord)
    premier_roster: Optional[PremierRosterInMatch] = None


# --------------------------------------------------------------------------- #
# Rounds
# --------------------------------------------------------------------------- #
class Actor(_Base):
    """A player reference embedded in kills / plants / round stats."""

    puuid: Optional[str] = None
    team: Optional[str] = None
    name: Optional[str] = None
    tag: Optional[str] = None


class Location(_Base):
    """A map-space coordinate (game world units)."""

    x: Optional[int] = None
    y: Optional[int] = None


class PlantEvent(_Base):
    round_time_in_ms: Optional[int] = None
    site: Optional[str] = None
    location: Optional[Location] = None
    player: Actor = Field(default_factory=Actor)


class DefuseEvent(_Base):
    round_time_in_ms: Optional[int] = None
    player: Actor = Field(default_factory=Actor)


class RoundEconomy(_Base):
    loadout_value: int = 0
    remaining: int = 0
    spent: int = 0


class RoundPlayerStat(_Base):
    player: Actor = Field(default_factory=Actor)
    economy: RoundEconomy = Field(default_factory=RoundEconomy)


class Round(_Base):
    id: Optional[int] = None
    result: Optional[str] = None
    winning_team: Optional[str] = None
    plant: Optional[PlantEvent] = None
    defuse: Optional[DefuseEvent] = None
    stats: list[RoundPlayerStat] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Kills
# --------------------------------------------------------------------------- #
class WeaponInfo(_Base):
    id: Optional[str] = None
    name: Optional[str] = None


class Kill(_Base):
    round: Optional[int] = None
    time_in_round_in_ms: Optional[int] = None
    time_in_match_in_ms: Optional[int] = None
    killer: Actor = Field(default_factory=Actor)
    victim: Actor = Field(default_factory=Actor)
    assistants: list[Actor] = Field(default_factory=list)
    weapon: WeaponInfo = Field(default_factory=WeaponInfo)
    location: Optional[Location] = None  # victim's death position


# --------------------------------------------------------------------------- #
# Top-level match
# --------------------------------------------------------------------------- #
class MatchV4(_Base):
    metadata: MatchMetadata = Field(default_factory=MatchMetadata)
    players: list[MatchPlayer] = Field(default_factory=list)
    teams: list[MatchTeam] = Field(default_factory=list)
    rounds: list[Round] = Field(default_factory=list)
    kills: list[Kill] = Field(default_factory=list)

    def team_of(self, puuid: Optional[str]) -> Optional[str]:
        for p in self.players:
            if p.puuid and p.puuid == puuid:
                return p.team_id
        return None

    @staticmethod
    def parse(data: dict[str, Any]) -> "MatchV4":
        """Accept either the raw match object or a {status, data} envelope."""
        if isinstance(data, dict) and "data" in data and "metadata" not in data:
            data = data["data"]
        return MatchV4.model_validate(data)


# --------------------------------------------------------------------------- #
# Premier
# --------------------------------------------------------------------------- #
class PremierRosterMember(_Base):
    puuid: Optional[str] = None
    name: Optional[str] = None
    tag: Optional[str] = None


class PremierStats(_Base):
    wins: int = 0
    losses: int = 0
    matches: int = 0
    rounds_won: int = 0
    rounds_lost: int = 0


class PremierPlacement(_Base):
    points: Optional[int] = None
    conference: Optional[str] = None
    division: Optional[int] = None
    place: Optional[int] = None


class PremierCustomization(_Base):
    icon: Optional[str] = None
    image: Optional[str] = None      # ready-to-use team-icon URL (rendered in team colors)
    primary: Optional[str] = None
    secondary: Optional[str] = None
    tertiary: Optional[str] = None


class PremierTeam(_Base):
    id: Optional[str] = None
    name: Optional[str] = None
    tag: Optional[str] = None
    enrolled: Optional[bool] = None
    stats: PremierStats = Field(default_factory=PremierStats)
    placement: PremierPlacement = Field(default_factory=PremierPlacement)
    customization: PremierCustomization = Field(default_factory=PremierCustomization)
    # Roster from the /premier/{name}/{tag} endpoint; frequently empty — the reliable
    # roster comes from teams[].premier_roster on each match instead.
    member: list = Field(default_factory=list)

    def summary(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "tag": self.tag,
            "conference": self.placement.conference,
            "division": self.placement.division,
            "place": self.placement.place,
            "points": self.placement.points,
            "wins": self.stats.wins,
            "losses": self.stats.losses,
            "image": self.customization.image,
            "colors": {
                "primary": self.customization.primary,
                "secondary": self.customization.secondary,
                "tertiary": self.customization.tertiary,
            },
        }


class PremierHistoryEntry(_Base):
    id: Optional[str] = Field(default=None, alias="id")
    match_id: Optional[str] = None
    points_before: Optional[int] = None
    points_after: Optional[int] = None
    started_at: Optional[str] = None

    @property
    def resolved_match_id(self) -> Optional[str]:
        return self.match_id or self.id
