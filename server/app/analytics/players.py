"""Per-player aggregate stats across the season: ACS, ADR, KAST, HS%, KD, multikills, clutches."""
from __future__ import annotations

from app.analytics.common import MatchContext, pct, safe_div
from app.analytics.rounds import RoundBreakdown


def _new_row(puuid: str) -> dict:
    return {
        "puuid": puuid,
        "name": None,
        "card": None,
        "agents": {},
        "agent_wins": {},
        "roles": {},
        "role_wins": {},
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


def _normalize_role(agent_name: str | None) -> str | None:
    if not agent_name:
        return None
    key = agent_name.lower().replace("-", "").replace(" ", "")
    if key in {"jett", "reyna", "raze", "phoenix", "yoru", "neon", "iso", "waylay"}:
        return "Duelist"
    if key in {"omen", "brimstone", "viper", "astra", "harbor", "clove"}:
        return "Controller"
    if key in {"sova", "skye", "breach", "kay/o", "gekko", "fade", "tejo"}:
        return "Initiator"
    if key in {"cypher", "killjoy", "chamber", "sage", "deadlock", "vyse", "veto"}:
        return "Sentinel"
    return None


def _ordered_stats(counter: dict[str, int], win_counter: dict[str, int]) -> list[dict]:
    return [
        {
            "name": name,
            "games": n,
            "wins": win_counter.get(name, 0),
            "win_rate": pct(win_counter.get(name, 0), n),
        }
        for name, n in sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))
    ]


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
            # Contexts are most-recent first, so keep the first card seen.
            if not row["card"] and p.customization.card:
                row["card"] = p.customization.card
            if p.agent.name:
                agent_name = p.agent.name
                row["agents"][agent_name] = row["agents"].get(agent_name, 0) + 1
                if ctx.team_won:
                    row["agent_wins"][agent_name] = row["agent_wins"].get(agent_name, 0) + 1
                role_name = _normalize_role(agent_name)
                if role_name:
                    row["roles"][role_name] = row["roles"].get(role_name, 0) + 1
                    if ctx.team_won:
                        row["role_wins"][role_name] = row["role_wins"].get(role_name, 0) + 1
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
        row["agents"] = _ordered_stats(row["agents"], row["agent_wins"])
        row["roles"] = _ordered_stats(row["roles"], row["role_wins"])

    return rows
