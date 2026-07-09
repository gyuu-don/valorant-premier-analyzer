"""Opening-duel / entry analysis."""
from __future__ import annotations

from app.analytics.common import ATTACK, DEFENSE, MatchContext, pct
from app.analytics.rounds import RoundBreakdown


def compute_entries(
    data: list[tuple[MatchContext, list[RoundBreakdown]]]
) -> dict:
    total = won = 0
    by_side = {ATTACK: {"won": 0, "total": 0}, DEFENSE: {"won": 0, "total": 0}}
    per_player: dict[str, dict] = {}

    for _ctx, rounds in data:
        for rb in rounds:
            if rb.first_kill_by_us is None:
                continue
            total += 1
            by_side[rb.side]["total"] += 1
            if rb.first_kill_by_us:
                won += 1
                by_side[rb.side]["won"] += 1
                pp = per_player.setdefault(rb.first_killer, {"first_kills": 0, "first_deaths": 0})
                pp["first_kills"] += 1
            else:
                pp = per_player.setdefault(rb.first_victim, {"first_kills": 0, "first_deaths": 0})
                pp["first_deaths"] += 1

    for puuid, pp in per_player.items():
        attempts = pp["first_kills"] + pp["first_deaths"]
        pp["entry_win_rate"] = pct(pp["first_kills"], attempts)

    return {
        "opening_duel_win_rate": pct(won, total),
        "opening_duels": total,
        "by_side": {
            side: pct(v["won"], v["total"]) for side, v in by_side.items()
        },
        "per_player": per_player,
    }
