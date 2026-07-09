"""Aggregate a set of matches into a full team report + plain-language coaching callouts."""
from __future__ import annotations

from app.analytics.common import build_context, pct
from app.analytics.match_analysis import team_positions
from app.analytics.entries import compute_entries
from app.analytics.maps import compute_maps
from app.analytics.mvp import compute_mvp
from app.analytics.players import compute_players
from app.analytics.rounds import all_breakdowns
from app.analytics.sides import compute_sides
from app.analytics.situational import compute_situational
from app.analytics.sites import compute_sites
from app.analytics.trades import compute_trades
from app.analytics.utility import compute_utility
from app.models import MatchV4, PremierTeam


def _recent_form(contexts) -> list[dict]:
    """Win/loss per match with its date, sorted chronologically (oldest first).

    History order from the API is not guaranteed, so we sort by started_at here; the
    frontend renders left = oldest, right = most recent.
    """
    items = [
        {"result": "W" if c.team_won else "L", "started_at": c.match.metadata.started_at}
        for c in contexts
    ]
    items.sort(key=lambda x: x["started_at"] or "")
    return items


# Point margins (percentage points) for grading a metric against the opponent baseline.
_BELOW = 3.0    # trailing the division by this much -> flag as a weakness
_WELL_BELOW = 8.0
_ABOVE = 5.0    # leading by this much -> call out as a strength


def _grade(area: str, ours: float, theirs: float, tip: str, higher_is_better: bool = True) -> dict | None:
    """Compare a metric to the opponent baseline and produce a relative callout."""
    gap = (ours - theirs) if higher_is_better else (theirs - ours)
    vs = f"{ours}% vs {theirs}% for opponents faced"
    if gap <= -_WELL_BELOW:
        return {"severity": "high", "area": area, "gap": round(gap, 1),
                "text": f"{vs} — well below division norm. {tip}"}
    if gap <= -_BELOW:
        return {"severity": "medium", "area": area, "gap": round(gap, 1),
                "text": f"{vs} — below division norm. {tip}"}
    if gap >= _ABOVE:
        return {"severity": "info", "area": area, "gap": round(gap, 1),
                "text": f"{vs} — above division norm. This is a relative strength."}
    return {"severity": "low", "area": area, "gap": round(gap, 1),
            "text": f"{vs} — roughly on par with the division."}


def _callouts(sides: dict, sites: dict, entries: dict, trades: dict, baseline: dict | None) -> list[dict]:
    """Prioritized notes, benchmarked against the opponents actually faced when available."""
    notes: list[dict] = []

    # Internal side balance is meaningful regardless of the opponent baseline; always shown.
    atk, dfn = sides["attack_win_rate"], sides["defense_win_rate"]
    gap = round(abs(atk - dfn), 1)
    if gap >= 8:
        weaker, wr = ("attack", atk) if atk < dfn else ("defense", dfn)
        notes.append({
            "severity": "high", "area": "Side balance",
            "text": f"{weaker.capitalize()} is the weaker side at {wr}% round win rate "
                    f"(vs {max(atk, dfn)}% on the other side). Prioritize {weaker} setups in practice.",
        })
    else:
        notes.append({
            "severity": "info", "area": "Side balance",
            "text": f"Sides are balanced — attack {atk}% vs defense {dfn}% round win rate "
                    f"({gap} pt gap). No clear side to prioritize.",
        })

    if baseline:
        graded = [
            _grade("Entries", entries["opening_duel_win_rate"], baseline["opening_duel_win_rate"],
                   "Structure entry support: trade partners and flashes for the entry fragger."),
            _grade("Trades", trades["deaths_traded_rate"], baseline["deaths_traded_rate"],
                   "Play tighter spacing so a teammate can punish the killer within a few seconds."),
            _grade("Retakes", sites["defense"]["retake_success_rate"], baseline["retake_success_rate"],
                   "Bank utility/ults for coordinated post-plant retakes rather than picking duels."),
            _grade("Post-plant", sites["attack"]["post_plant_conversion"], baseline["post_plant_conversion"],
                   "Reinforce default post-plant positions and crossfires."),
        ]
        # Weaknesses first (largest negative gap), then strengths/par.
        graded = [g for g in graded if g]
        graded.sort(key=lambda g: g["gap"])
        notes.extend(graded)

    if not notes:
        notes.append({
            "severity": "info", "area": "General",
            "text": "No major gaps vs the opponents faced. Pull more matches for a higher-confidence read.",
        })
    return notes


def compute_map_detail(contexts) -> dict:
    """Per-map cumulative positions (deaths/kills/plants across all matches on that map)
    plus per-map agent usage and site stats. Positions share the map's coordinate system, so pooling
    across matches on the same map is valid."""
    window = trade_window_ms_default()
    data = all_breakdowns(contexts, window)
    
    detail: dict[str, dict] = {}
    for ctx in contexts:
        name = ctx.match.metadata.map_name
        d = detail.setdefault(
            name, {"positions": {"deaths": [], "kills": [], "plants": []}, "_agents": {}}
        )
        pos = team_positions(ctx)
        for key in ("deaths", "kills", "plants"):
            d["positions"][key].extend(pos[key])
        for p in ctx.our_players():
            if p.agent.name:
                a = d["_agents"].setdefault(p.agent.name, {"games": 0, "wins": 0})
                a["games"] += 1
                a["wins"] += int(ctx.team_won)

    # Group round breakdowns by map for per-map site stats
    map_rounds: dict[str, list[tuple]] = {}
    for ctx, rounds in data:
        map_name = ctx.match.metadata.map_name
        map_rounds.setdefault(map_name, []).append((ctx, rounds))

    out: dict[str, dict] = {}
    for name, d in detail.items():
        agents = {
            an: {"games": v["games"], "wins": v["wins"], "win_rate": pct(v["wins"], v["games"])}
            for an, v in sorted(d["_agents"].items(), key=lambda kv: -kv[1]["games"])
        }
        # Compute per-map site stats
        site_data = compute_sites(map_rounds.get(name, []))
        out[name] = {
            "positions": d["positions"],
            "agents": agents,
            "sites": site_data,
        }
    return out


def build_map_detail(team: PremierTeam, matches: list[MatchV4]) -> dict:
    contexts = [c for c in (build_context(m, team.id) if team.id else None for m in matches) if c]
    return {"maps": compute_map_detail(contexts)}


def build_match_summaries(team: PremierTeam, matches: list[MatchV4]) -> list[dict]:
    """Per-match summary rows for the deep-dive picker, sorted most-recent first."""
    out: list[dict] = []
    for m in matches:
        ctx = build_context(m, team.id) if team.id else None
        if ctx is None:
            continue
        opp = next((t for t in m.teams if t.team_id == ctx.opp_team_id), None)
        opponent = (
            opp.premier_roster.name
            if opp and opp.premier_roster and opp.premier_roster.name
            else "Unknown"
        )
        our = next((t for t in m.teams if t.team_id == ctx.our_team_id), None)
        won = our.rounds.won if our else 0
        lost = our.rounds.lost if our else 0
        out.append({
            "match_id": m.metadata.match_id,
            "started_at": m.metadata.started_at,
            "map": m.metadata.map_name,
            "opponent": opponent,
            "result": "W" if ctx.team_won else "L",
            "score": f"{won}-{lost}",
        })
    out.sort(key=lambda x: x["started_at"] or "", reverse=True)
    return out


def compute_mvp_awards(contexts, window: int) -> dict:
    """Per-match MVP awards across the stage: who most often earned the game-determined
    MVP (top combat score on our team), and how often the Advanced MVP (impact rating)
    disagreed with it."""
    game_counts: dict[str, dict] = {}
    differed = 0
    matches = 0

    for ctx in contexts:
        data = all_breakdowns([ctx], window)
        players = compute_players(data)
        if not players:
            continue
        matches += 1
        m = compute_mvp(players, compute_entries(data), compute_trades(data))
        advanced = m["ranking"][0]["puuid"] if m["ranking"] else None
        game = m["official_mvp"]["puuid"] if m["official_mvp"] else None
        if game:
            gc = game_counts.setdefault(game, {"name": players[game]["name"], "count": 0})
            gc["count"] += 1
        if game and advanced and game != advanced:
            differed += 1

    leader = max(game_counts.items(), key=lambda kv: kv[1]["count"], default=None)
    return {
        "matches": matches,
        "most_game_mvp": (
            {
                "puuid": leader[0],
                "name": leader[1]["name"],
                "count": leader[1]["count"],
                "pct": pct(leader[1]["count"], matches),
            }
            if leader
            else None
        ),
        "differed": differed,
        "differed_pct": pct(differed, matches),
    }


def _tactical_summary(contexts, window: int) -> dict:
    """Compute the tactical metrics used for the opponent baseline comparison."""
    data = all_breakdowns(contexts, window)
    entries = compute_entries(data)
    trades = compute_trades(data)
    sites = compute_sites(data)
    return {
        "opening_duel_win_rate": entries["opening_duel_win_rate"],
        "deaths_traded_rate": trades["deaths_traded_rate"],
        "retake_success_rate": sites["defense"]["retake_success_rate"],
        "post_plant_conversion": sites["attack"]["post_plant_conversion"],
        "hold_success_rate": sites["defense"]["hold_success_rate"],
    }


def build_report(team: PremierTeam, matches: list[MatchV4]) -> dict:
    contexts = []
    opp_contexts = []
    for match in matches:
        ctx = build_context(match, team.id) if team.id else None
        if ctx is None:
            continue
        contexts.append(ctx)
        # Opponent context (for the division baseline) via the opposing roster.
        opp_puuids = {p.puuid for p in match.players if p.team_id == ctx.opp_team_id and p.puuid}
        octx = build_context(match, opp_puuids) if opp_puuids else None
        if octx is not None:
            opp_contexts.append(octx)

    if not contexts:
        return {
            "team": team.summary(),
            "matches_analyzed": 0,
            "warning": "No analyzable matches found. Confirm the team id resolves inside "
                       "teams[].premier_roster and that the region is correct.",
        }

    window = trade_window_ms_default()
    data = all_breakdowns(contexts, window)

    entries = compute_entries(data)
    trades = compute_trades(data)
    sites = compute_sites(data)
    sides = compute_sides(contexts)
    players = compute_players(data)
    utility = compute_utility(data)
    maps = compute_maps(contexts)
    mvp = compute_mvp(players, entries, trades)
    mvp["awards"] = compute_mvp_awards(contexts, window)

    # Opponent baseline ("the division you actually play").
    baseline = _tactical_summary(opp_contexts, window) if opp_contexts else None
    if baseline is not None:
        opp_sides = compute_sides(opp_contexts)
        baseline["attack_win_rate"] = opp_sides["attack_win_rate"]
        baseline["defense_win_rate"] = opp_sides["defense_win_rate"]
        baseline["matches"] = len(opp_contexts)

    wins = sum(1 for c in contexts if c.team_won)

    return {
        "team": {**team.summary(), "region": get_region()},
        "matches_analyzed": len(contexts),
        "trade_window_ms": window,
        "record": {"wins": wins, "losses": len(contexts) - wins},
        "recent_form": _recent_form(contexts),
        "sides": sides,
        "situational": compute_situational(contexts),
        "sites": sites,
        "entries": entries,
        "trades": trades,
        "utility": utility,
        "maps": maps["maps"],
        "agents": maps["agents"],
        "players": list(players.values()),
        "mvp": mvp,
        "baseline": baseline,
        "callouts": _callouts(sides, sites, entries, trades, baseline),
    }


def trade_window_ms_default() -> int:
    # Imported lazily to keep this module import-light for testing.
    from app.config import get_settings

    return get_settings().trade_window_ms


def get_region() -> str:
    from app.config import get_settings

    return get_settings().premier_region
