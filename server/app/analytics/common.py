"""Shared helpers: identify *our* team within a match and infer per-round side.

A HenrikDev match labels teams only as "Red"/"Blue", so we locate our team by matching
the Premier roster PUUIDs to the players. Attack/defense side per round is not always
labeled explicitly, so we infer it: the spike can only be planted by the attacking team,
which anchors which team attacked in the first half; the standard 12/12 half structure
(and alternating overtime) then gives the side for every round.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.models import MatchPlayer, MatchV4

ATTACK = "attack"
DEFENSE = "defense"
FIRST_HALF_ROUNDS = 12
REGULATION_ROUNDS = 24


def team_ids(match: MatchV4) -> list[str]:
    ids = [t.team_id for t in match.teams if t.team_id]
    if len(ids) >= 2:
        return ids[:2]
    # Fallback: derive from players.
    seen: list[str] = []
    for p in match.players:
        if p.team_id and p.team_id not in seen:
            seen.append(p.team_id)
    return seen[:2]


def _other(team: str, ids: list[str]) -> Optional[str]:
    for tid in ids:
        if tid != team:
            return tid
    return None


def _infer_first_half_attacker(match: MatchV4, ids: list[str]) -> Optional[str]:
    """Vote across planted rounds to decide which team attacked the first half."""
    votes: dict[str, int] = {}
    for idx, rnd in enumerate(match.rounds):
        if not rnd.plant or not rnd.plant.player.team:
            continue
        planter = rnd.plant.player.team
        other = _other(planter, ids)
        if idx < FIRST_HALF_ROUNDS:
            attacker = planter
        elif idx < REGULATION_ROUNDS:
            attacker = other
        else:  # overtime alternates each round
            attacker = planter if (idx - REGULATION_ROUNDS) % 2 == 0 else other
        if attacker:
            votes[attacker] = votes.get(attacker, 0) + 1
    if not votes:
        return None
    return max(votes, key=votes.get)


def _side_for_team(round_index: int, team: str, first_half_attacker: str, ids: list[str]) -> str:
    other = _other(first_half_attacker, ids)
    if round_index < FIRST_HALF_ROUNDS:
        attacker = first_half_attacker
    elif round_index < REGULATION_ROUNDS:
        attacker = other
    else:
        attacker = first_half_attacker if (round_index - REGULATION_ROUNDS) % 2 == 0 else other
    return ATTACK if team == attacker else DEFENSE


@dataclass
class MatchContext:
    match: MatchV4
    our_team_id: str
    opp_team_id: Optional[str]
    our_puuids: set[str]
    team_won: bool
    rounds_won: int
    rounds_lost: int
    # round index -> side our team was on ("attack"/"defense")
    round_sides: dict[int, str] = field(default_factory=dict)

    def our_players(self) -> list[MatchPlayer]:
        return [p for p in self.match.players if p.puuid in self.our_puuids]

    def is_ours(self, puuid: Optional[str]) -> bool:
        return bool(puuid) and puuid in self.our_puuids


def build_context(match: MatchV4, our_premier_id: str) -> Optional[MatchContext]:
    """Locate our team within a match by its Premier team id (teams[].premier_roster.id).

    Falls back to matching a set of roster PUUIDs if a set is passed instead of an id
    (used by unit tests / when a match lacks premier_roster).
    """
    ids = team_ids(match)
    if len(ids) < 2:
        return None

    our_team_id: Optional[str] = None

    if isinstance(our_premier_id, (set, frozenset)):
        # Roster-PUUID identification (test / fallback path).
        roster_puuids = our_premier_id
        counts = {tid: 0 for tid in ids}
        for p in match.players:
            if p.puuid in roster_puuids and p.team_id in counts:
                counts[p.team_id] += 1
        if any(counts.values()):
            our_team_id = max(counts, key=counts.get)
    else:
        # Preferred: match the embedded Premier roster id.
        for t in match.teams:
            if t.premier_roster and t.premier_roster.id == our_premier_id:
                our_team_id = t.team_id
                break

    if our_team_id is None:
        return None
    opp_team_id = _other(our_team_id, ids)

    our_puuids = {
        p.puuid
        for p in match.players
        if p.team_id == our_team_id and p.puuid
    }

    team_row = next((t for t in match.teams if t.team_id == our_team_id), None)
    team_won = bool(team_row.won) if team_row else False
    rounds_won = team_row.rounds.won if team_row else 0
    rounds_lost = team_row.rounds.lost if team_row else 0

    first_half_attacker = _infer_first_half_attacker(match, ids) or our_team_id
    round_sides = {
        idx: _side_for_team(idx, our_team_id, first_half_attacker, ids)
        for idx in range(len(match.rounds))
    }

    return MatchContext(
        match=match,
        our_team_id=our_team_id,
        opp_team_id=opp_team_id,
        our_puuids=our_puuids,
        team_won=team_won,
        rounds_won=rounds_won,
        rounds_lost=rounds_lost,
        round_sides=round_sides,
    )


def safe_div(num: float, den: float, default: float = 0.0) -> float:
    return num / den if den else default


def pct(num: float, den: float) -> float:
    """Percentage rounded to one decimal."""
    return round(100.0 * safe_div(num, den), 1)
