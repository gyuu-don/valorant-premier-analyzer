"""Aggregate a set of matches into a full team report + plain-language coaching callouts."""
from __future__ import annotations

from app.analytics.common import build_context
from app.analytics.entries import compute_entries
from app.analytics.maps import compute_maps
from app.analytics.mvp import compute_mvp
from app.analytics.players import compute_players
from app.analytics.rounds import all_breakdowns
from app.analytics.sides import compute_sides
from app.analytics.sites import compute_sites
from app.analytics.trades import compute_trades
from app.analytics.utility import compute_utility
from app.models import MatchV4, PremierTeam


def _recent_form(contexts) -> list[str]:
    # Most recent first is not guaranteed; return in the order given.
    return ["W" if c.team_won else "L" for c in contexts]


def _callouts(sides: dict, sites: dict, entries: dict, trades: dict) -> list[dict]:
    """Turn key numbers into prioritized, human-readable improvement notes."""
    notes: list[dict] = []

    atk, dfn = sides["attack_win_rate"], sides["defense_win_rate"]
    if abs(atk - dfn) >= 8:
        weaker, wr = ("attack", atk) if atk < dfn else ("defense", dfn)
        notes.append({
            "severity": "high",
            "area": "Side balance",
            "text": f"{weaker.capitalize()} is the weaker side at {wr}% round win rate "
                    f"(vs {max(atk, dfn)}% on the other side). Prioritize {weaker} setups in practice.",
        })

    entry = entries["opening_duel_win_rate"]
    if entry < 50 and entries["opening_duels"] > 0:
        notes.append({
            "severity": "high" if entry < 45 else "medium",
            "area": "Entries",
            "text": f"Opening-duel win rate is {entry}%. Consider structured entry support "
                    f"(trade partners, flashes for the entry fragger) to flip first bloods.",
        })

    traded = trades["deaths_traded_rate"]
    if traded < 55 and trades["total_deaths"] > 0:
        notes.append({
            "severity": "medium",
            "area": "Trades",
            "text": f"Only {traded}% of deaths are traded. Play tighter spacing so a "
                    f"teammate can punish the killer within a few seconds.",
        })

    retake = sites["defense"]["retake_success_rate"]
    if sites["defense"]["retake_opportunities"] >= 3 and retake < 40:
        notes.append({
            "severity": "medium",
            "area": "Retakes",
            "text": f"Retake success is {retake}%. Bank utility/ults for coordinated "
                    f"post-plant retakes rather than picking duels.",
        })

    post_plant = sites["attack"]["post_plant_conversion"]
    if sites["attack"]["plants"] >= 3 and post_plant < 70:
        notes.append({
            "severity": "low",
            "area": "Post-plant",
            "text": f"Post-plant conversion is {post_plant}%. Reinforce default post-plant "
                    f"positions and crossfires to close out planted rounds.",
        })

    if not notes:
        notes.append({
            "severity": "info",
            "area": "General",
            "text": "No major weaknesses flagged from the current sample. Pull more matches "
                    "for a higher-confidence read.",
        })
    return notes


def build_report(team: PremierTeam, matches: list[MatchV4]) -> dict:
    roster_puuids = {m.puuid for m in team.members if m.puuid}

    contexts = []
    for match in matches:
        ctx = build_context(match, roster_puuids)
        if ctx is not None:
            contexts.append(ctx)

    if not contexts:
        return {
            "team": team.model_dump(),
            "matches_analyzed": 0,
            "warning": "No analyzable matches found. Check the roster PUUIDs and region, "
                       "and confirm the HenrikDev match field names against a live sample.",
        }

    data = all_breakdowns(contexts, trade_window_ms_default())

    entries = compute_entries(data)
    trades = compute_trades(data)
    sites = compute_sites(data)
    sides = compute_sides(contexts)
    players = compute_players(data)
    utility = compute_utility(data)
    maps = compute_maps(contexts)
    mvp = compute_mvp(players, entries, trades)

    wins = sum(1 for c in contexts if c.team_won)

    return {
        "team": {
            "id": team.id,
            "name": team.name,
            "tag": team.tag,
            "region": team.region,
            "conference": team.conference,
            "division": team.division,
        },
        "matches_analyzed": len(contexts),
        "record": {"wins": wins, "losses": len(contexts) - wins},
        "recent_form": _recent_form(contexts),
        "sides": sides,
        "sites": sites,
        "entries": entries,
        "trades": trades,
        "utility": utility,
        "maps": maps["maps"],
        "agents": maps["agents"],
        "players": list(players.values()),
        "mvp": mvp,
        "callouts": _callouts(sides, sites, entries, trades),
    }


def trade_window_ms_default() -> int:
    # Imported lazily to keep this module import-light for testing.
    from app.config import get_settings

    return get_settings().trade_window_ms
