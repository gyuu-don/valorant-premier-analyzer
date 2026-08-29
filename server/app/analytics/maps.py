"""Per-map and per-agent breakdown for our team."""
from __future__ import annotations

from app.analytics.common import ATTACK, DEFENSE, MatchContext, pct


def _leader(counter: dict[str, int], names: dict[str, str]) -> dict | None:
    if not counter:
        return None
    player, count = max(counter.items(), key=lambda kv: (kv[1], -ord(kv[0][0]) if kv[0] else 0))
    return {"player": names.get(player, player), "games": count}


def _wins_leader(counter: dict[str, int], names: dict[str, str]) -> dict | None:
    if not counter:
        return None
    player, wins = max(counter.items(), key=lambda kv: (kv[1], -ord(kv[0][0]) if kv[0] else 0))
    return {"player": names.get(player, player), "wins": wins}


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
            agent_key = p.agent.name
            a = agents.setdefault(
                agent_key,
                {"games": 0, "wins": 0, "_players": {}, "_player_names": {}, "_wins": {}, "_win_names": {}},
            )
            a["games"] += 1
            a["wins"] += int(ctx.team_won)
            player_key = p.puuid or p.display_name or p.name
            if player_key:
                a["_players"][player_key] = a["_players"].get(player_key, 0) + 1
                a["_player_names"][player_key] = p.display_name or p.name or player_key
                if ctx.team_won:
                    a["_wins"][player_key] = a["_wins"].get(player_key, 0) + 1
                    a["_win_names"][player_key] = p.display_name or p.name or player_key

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
    agents_out = {}
    for name, v in sorted(agents.items(), key=lambda kv: -kv[1]["games"]):
        agents_out[name] = {
            "games": v["games"],
            "wins": v["wins"],
            "win_rate": pct(v["wins"], v["games"]),
            "most_played_by": _leader(v["_players"], v["_player_names"]),
            "most_wins_by": _wins_leader(v["_wins"], v["_win_names"]),
        }
    return {"maps": maps_out, "agents": agents_out}
