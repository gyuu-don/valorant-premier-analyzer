"""Per-map and per-agent breakdown for our team."""
from __future__ import annotations

from app.analytics.common import ATTACK, DEFENSE, MatchContext, pct


def compute_maps(contexts: list[MatchContext]) -> dict:
    maps: dict[str, dict] = {}
    agents: dict[str, dict] = {}

    for ctx in contexts:
        name = ctx.match.metadata.map_name
        m = maps.setdefault(
            name,
            {"games": 0, "wins": 0, "atk_won": 0, "atk_total": 0, "def_won": 0, "def_total": 0},
        )
        m["games"] += 1
        m["wins"] += int(ctx.team_won)

        for idx, rnd in enumerate(ctx.match.rounds):
            side = ctx.round_sides.get(idx, ATTACK)
            won = rnd.winning_team == ctx.our_team_id if rnd.winning_team else False
            if side == ATTACK:
                m["atk_total"] += 1
                m["atk_won"] += int(won)
            else:
                m["def_total"] += 1
                m["def_won"] += int(won)

        for p in ctx.our_players():
            if not p.agent.name:
                continue
            a = agents.setdefault(p.agent.name, {"games": 0, "wins": 0})
            a["games"] += 1
            a["wins"] += int(ctx.team_won)

    maps_out = {
        name: {
            "games": v["games"],
            "wins": v["wins"],
            "win_rate": pct(v["wins"], v["games"]),
            "attack_round_win_rate": pct(v["atk_won"], v["atk_total"]),
            "defense_round_win_rate": pct(v["def_won"], v["def_total"]),
        }
        for name, v in sorted(maps.items(), key=lambda kv: -kv[1]["games"])
    }
    agents_out = {
        name: {
            "games": v["games"],
            "wins": v["wins"],
            "win_rate": pct(v["wins"], v["games"]),
        }
        for name, v in sorted(agents.items(), key=lambda kv: -kv[1]["games"])
    }
    return {"maps": maps_out, "agents": agents_out}
