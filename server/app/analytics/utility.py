"""Player utility effectiveness.

IMPORTANT LIMITATION: the HenrikDev match payload exposes ability casts only as
per-match *aggregate* counts (grenade / ability1 / ability2 / ultimate) and does not
timestamp casts against kills. We therefore report casts-per-round and assists-per-round
(assists being a proxy for utility that enabled a teammate's kill). This is intentionally
labeled a proxy in the UI, not a precise "utility followed up on" causation metric.
"""
from __future__ import annotations

from app.analytics.common import MatchContext, safe_div


def _new_row(puuid: str) -> dict:
    return {
        "puuid": puuid,
        "name": None,
        "rounds_played": 0,
        "grenade": 0,
        "ability1": 0,
        "ability2": 0,
        "ultimate": 0,
        "assists": 0,
    }


def compute_utility(
    data: list[tuple[MatchContext, list]]
) -> dict:
    rows: dict[str, dict] = {}

    for ctx, _rounds in data:
        rounds_count = len(ctx.match.rounds)
        for p in ctx.our_players():
            if not p.puuid:
                continue
            row = rows.setdefault(p.puuid, _new_row(p.puuid))
            row["name"] = p.display_name
            row["rounds_played"] += rounds_count
            row["grenade"] += p.ability_casts.grenade
            row["ability1"] += p.ability_casts.ability1
            row["ability2"] += p.ability_casts.ability2
            row["ultimate"] += p.ability_casts.ultimate
            row["assists"] += p.stats.assists

    for row in rows.values():
        rp = row["rounds_played"]
        total_casts = row["grenade"] + row["ability1"] + row["ability2"] + row["ultimate"]
        row["casts_per_round"] = round(safe_div(total_casts, rp), 2)
        row["grenade_per_round"] = round(safe_div(row["grenade"], rp), 2)
        row["ability1_per_round"] = round(safe_div(row["ability1"], rp), 2)
        row["ability2_per_round"] = round(safe_div(row["ability2"], rp), 2)
        row["ultimate_per_round"] = round(safe_div(row["ultimate"], rp), 2)
        row["assists_per_round"] = round(safe_div(row["assists"], rp), 2)

    return {
        "note": (
            "Ability casts are per-match aggregates; casts-per-round and assists-per-round "
            "are proxies for utility impact, not timestamped cast-to-kill causation."
        ),
        "per_player": rows,
    }
