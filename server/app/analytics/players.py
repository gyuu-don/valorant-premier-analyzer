"""Per-player aggregate stats across the season: ACS, ADR, KAST, HS%, KD, multikills, clutches."""
from __future__ import annotations

from app.analytics.common import MatchContext, pct, safe_div
from app.analytics.rounds import RoundBreakdown


def _new_row(puuid: str) -> dict:
    return {
        "puuid": puuid,
        "name": None,
        "agents": {},
        "rounds_played": 0,
        "kills": 0,
        "deaths": 0,
        "assists": 0,
        "score": 0,
        "damage": 0,
        "headshots": 0,
        "bodyshots": 0,
        "legshots": 0,
        "kast_rounds": 0,
        "multikill_rounds": 0,
        "clutches": 0,
    }


def compute_players(
    data: list[tuple[MatchContext, list[RoundBreakdown]]]
) -> dict[str, dict]:
    rows: dict[str, dict] = {}

    for ctx, rounds in data:
        rounds_count = len(ctx.match.rounds)
        for p in ctx.our_players():
            if not p.puuid:
                continue
            row = rows.setdefault(p.puuid, _new_row(p.puuid))
            row["name"] = p.display_name
            if p.agent.name:
                row["agents"][p.agent.name] = row["agents"].get(p.agent.name, 0) + 1
            row["rounds_played"] += rounds_count
            row["kills"] += p.stats.kills
            row["deaths"] += p.stats.deaths
            row["assists"] += p.stats.assists
            row["score"] += p.stats.score
            row["damage"] += p.stats.damage.dealt
            row["headshots"] += p.stats.headshots
            row["bodyshots"] += p.stats.bodyshots
            row["legshots"] += p.stats.legshots

        for rb in rounds:
            for puuid in ctx.our_puuids:
                row = rows.get(puuid)
                if row is None:
                    continue
                got_kill = rb.kills_by_player.get(puuid, 0) > 0
                got_assist = rb.assists_by_player.get(puuid, 0) > 0
                survived = puuid in rb.survivors
                traded = puuid in rb.traded_deaths
                if got_kill or got_assist or survived or traded:
                    row["kast_rounds"] += 1
                if rb.kills_by_player.get(puuid, 0) >= 2:
                    row["multikill_rounds"] += 1
                if rb.clutch_puuid == puuid:
                    row["clutches"] += 1

    # Derived rate stats.
    for row in rows.values():
        rp = row["rounds_played"]
        shots = row["headshots"] + row["bodyshots"] + row["legshots"]
        row["acs"] = round(safe_div(row["score"], rp), 1)
        row["adr"] = round(safe_div(row["damage"], rp), 1)
        row["kd"] = round(safe_div(row["kills"], row["deaths"], default=float(row["kills"])), 2)
        row["kast"] = pct(row["kast_rounds"], rp)
        row["hs_pct"] = pct(row["headshots"], shots)
        # Sort agents by games played into an ordered list.
        row["agents"] = [
            {"name": name, "games": n}
            for name, n in sorted(row["agents"].items(), key=lambda kv: -kv[1])
        ]

    return rows
