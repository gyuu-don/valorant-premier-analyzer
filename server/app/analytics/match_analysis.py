"""Per-match ("single game") analytics powering the Match Analysis player card + MVP widget.

Builds a context for both teams, computes per-player stats for all 10 players, and a
match-scoped impact rating normalized across the whole lobby (so any clicked player has a
comparable number). The team-MVP widget filters the ranking to our side on the client.

Utility here is per-round *usage* only (per-match `ability_casts` ÷ rounds), by slot —
there are no ability-cast timestamps, so no kill/assist correlation is possible.
"""
from __future__ import annotations

from typing import Optional

from app.analytics.common import ATTACK, DEFENSE, build_context, pct, safe_div, team_ids
from app.analytics.entries import compute_entries
from app.analytics.mvp import compute_mvp
from app.analytics.players import compute_players
from app.analytics.rounds import all_breakdowns
from app.analytics.trades import compute_trades
from app.models import MatchV4


def _ctx_for_team(match: MatchV4, team_id: str):
    puuids = {p.puuid for p in match.players if p.team_id == team_id and p.puuid}
    return build_context(match, puuids) if puuids else None


def team_positions(ctx) -> dict:
    """Our team's death / kill / plant coordinates (raw game units), each tagged with
    side, pre/post-plant phase, and the involved player's puuid (for filtering)."""
    match = ctx.match
    rounds_with_kill = [k.round for k in match.kills if k.round is not None]
    kill_base = min(rounds_with_kill) if rounds_with_kill else 0
    plant_time_by_idx = {
        idx: (rnd.plant.round_time_in_ms if rnd.plant else None)
        for idx, rnd in enumerate(match.rounds)
    }

    def phase_for(idx, t) -> str:
        pt = plant_time_by_idx.get(idx)
        return "postplant" if (pt is not None and t is not None and t >= pt) else "preplant"

    deaths, kills, plants = [], [], []
    for k in match.kills:
        loc = k.location
        if not loc or loc.x is None or loc.y is None:
            continue
        idx = k.round - kill_base if k.round is not None else None
        side = ctx.round_sides.get(idx) if idx is not None else None
        phase = phase_for(idx, k.time_in_round_in_ms) if idx is not None else "preplant"
        if k.victim.puuid in ctx.our_puuids:
            deaths.append({"x": loc.x, "y": loc.y, "side": side, "phase": phase, "puuid": k.victim.puuid})
        if k.killer.puuid in ctx.our_puuids:
            kills.append({"x": loc.x, "y": loc.y, "side": side, "phase": phase, "puuid": k.killer.puuid})

    for idx, rnd in enumerate(match.rounds):
        plant = rnd.plant
        if plant and plant.location and plant.location.x is not None and plant.player.team == ctx.our_team_id:
            plants.append({
                "x": plant.location.x, "y": plant.location.y,
                "site": plant.site, "side": ctx.round_sides.get(idx),
                "phase": "postplant", "puuid": plant.player.puuid,
            })
    return {"deaths": deaths, "kills": kills, "plants": plants}


def _site_tendencies(ctx) -> dict:
    """This match: our attack plants by site (+ win rate, plant timing) and defense retakes
    by the enemy's plant site."""
    attack: dict[str, dict] = {}
    retakes: dict[str, dict] = {}
    plant_times: list[int] = []

    for idx, rnd in enumerate(ctx.match.rounds):
        plant = rnd.plant
        if not plant or not plant.site:
            continue
        side = ctx.round_sides.get(idx)
        won = rnd.winning_team == ctx.our_team_id if rnd.winning_team else False
        if side == ATTACK and plant.player.team == ctx.our_team_id:
            a = attack.setdefault(plant.site, {"plants": 0, "wins": 0})
            a["plants"] += 1
            a["wins"] += int(won)
            if plant.round_time_in_ms:
                plant_times.append(plant.round_time_in_ms)
        elif side == DEFENSE and plant.player.team not in (None, ctx.our_team_id):
            r = retakes.setdefault(plant.site, {"opportunities": 0, "wins": 0})
            r["opportunities"] += 1
            r["wins"] += int(won)

    total_plants = sum(a["plants"] for a in attack.values())
    return {
        "total_plants": total_plants,
        "avg_plant_time_s": round(safe_div(sum(plant_times), len(plant_times)) / 1000, 1) if plant_times else None,
        "attack_sites": {
            s: {"plants": a["plants"], "share": pct(a["plants"], total_plants), "win_rate": pct(a["wins"], a["plants"])}
            for s, a in sorted(attack.items())
        },
        "retake_sites": {
            s: {"opportunities": r["opportunities"], "win_rate": pct(r["wins"], r["opportunities"])}
            for s, r in sorted(retakes.items())
        },
    }


def build_match_analysis(
    match: MatchV4, our_premier_id: Optional[str], trade_window_ms: int
) -> Optional[dict]:
    ids = team_ids(match)
    if len(ids) < 2:
        return None

    # Which side is ours (for the team-MVP widget). May be None if not identifiable.
    our_team_id: Optional[str] = None
    if our_premier_id:
        for t in match.teams:
            if t.premier_roster and t.premier_roster.id == our_premier_id:
                our_team_id = t.team_id
                break

    rounds_count = max(len(match.rounds), 1)
    players_all: dict[str, dict] = {}
    entries_pp: dict[str, dict] = {}
    trades_pp: dict[str, dict] = {}
    contexts_by_team: dict[str, object] = {}

    for tid in ids:
        ctx = _ctx_for_team(match, tid)
        if ctx is None:
            continue
        contexts_by_team[tid] = ctx
        data = all_breakdowns([ctx], trade_window_ms)
        rows = compute_players(data)
        entries_pp.update(compute_entries(data)["per_player"])
        trades_pp.update(compute_trades(data)["per_player"])

        for puuid, row in rows.items():
            mp = next((p for p in match.players if p.puuid == puuid), None)
            row["team"] = tid
            row["agent"] = (
                {"id": mp.agent.id, "name": mp.agent.name} if mp else {"id": None, "name": None}
            )
            ac = mp.ability_casts if mp else None
            casts = {
                "grenade": ac.grenade if ac else 0,
                "ability1": ac.ability1 if ac else 0,
                "ability2": ac.ability2 if ac else 0,
                "ultimate": ac.ultimate if ac else 0,
            }
            per_round = {k: round(v / rounds_count, 2) for k, v in casts.items()}
            row["utility"] = {
                "casts": casts,
                "per_round": per_round,
                "total_per_round": round(sum(casts.values()) / rounds_count, 2),
            }
            players_all[puuid] = row

    if not players_all:
        return {"our_team_id": our_team_id, "players": [], "mvp": None}

    # Impact rating normalized across the whole lobby.
    mvp = compute_mvp(
        players_all,
        {"per_player": entries_pp},
        {"per_player": trades_pp},
    )
    rating_by = {r["puuid"]: r for r in mvp["ranking"]}

    for puuid, row in players_all.items():
        e = entries_pp.get(puuid, {})
        t = trades_pp.get(puuid, {})
        row["first_kills"] = e.get("first_kills", 0)
        row["first_deaths"] = e.get("first_deaths", 0)
        row["entry_win_rate"] = e.get("entry_win_rate", 0.0)
        row["deaths_traded"] = t.get("deaths_traded", 0)
        row["trade_kills"] = t.get("trade_kills", 0)
        r = rating_by.get(puuid)
        row["impact_rating"] = r["rating"] if r else None
        row["impact_components"] = r["components"] if r else {}

    our_ctx = contexts_by_team.get(our_team_id) if our_team_id else None
    positions = team_positions(our_ctx) if our_ctx else {"deaths": [], "kills": [], "plants": []}
    site_tendencies = _site_tendencies(our_ctx) if our_ctx else None

    return {
        "our_team_id": our_team_id,
        "players": list(players_all.values()),
        "mvp": mvp,
        "trade_window_ms": trade_window_ms,
        "positions": positions,
        "site_tendencies": site_tendencies,
    }
