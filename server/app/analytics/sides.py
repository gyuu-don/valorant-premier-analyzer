"""Overall team performance split by side (attack vs defense) plus economy buckets."""
from __future__ import annotations

from app.analytics.common import ATTACK, DEFENSE, MatchContext, pct

# Loadout-value thresholds (avg credits spent per player that round) used to bucket rounds.
ECO_MAX = 2000
FORCE_MAX = 3900


def _bucket(avg_loadout: float) -> str:
    if avg_loadout < ECO_MAX:
        return "eco"
    if avg_loadout < FORCE_MAX:
        return "force"
    return "full_buy"


def compute_sides(contexts: list[MatchContext]) -> dict:
    side_stats = {
        ATTACK: {"won": 0, "total": 0},
        DEFENSE: {"won": 0, "total": 0},
    }
    econ = {
        "eco": {"won": 0, "total": 0},
        "force": {"won": 0, "total": 0},
        "full_buy": {"won": 0, "total": 0},
    }

    for ctx in contexts:
        for idx, rnd in enumerate(ctx.match.rounds):
            side = ctx.round_sides.get(idx, ATTACK)
            won = rnd.winning_team == ctx.our_team_id if rnd.winning_team else False
            side_stats[side]["total"] += 1
            side_stats[side]["won"] += int(won)

            # Economy bucket from our players' loadout value that round.
            loadouts = [
                s.economy.loadout_value
                for s in rnd.stats
                if s.player.puuid in ctx.our_puuids and s.economy.loadout_value
            ]
            if loadouts:
                bucket = _bucket(sum(loadouts) / len(loadouts))
                econ[bucket]["total"] += 1
                econ[bucket]["won"] += int(won)

    return {
        "attack_win_rate": pct(side_stats[ATTACK]["won"], side_stats[ATTACK]["total"]),
        "defense_win_rate": pct(side_stats[DEFENSE]["won"], side_stats[DEFENSE]["total"]),
        "attack_rounds": side_stats[ATTACK]["total"],
        "defense_rounds": side_stats[DEFENSE]["total"],
        "economy": {
            bucket: {
                "win_rate": pct(v["won"], v["total"]),
                "rounds": v["total"],
            }
            for bucket, v in econ.items()
        },
    }
