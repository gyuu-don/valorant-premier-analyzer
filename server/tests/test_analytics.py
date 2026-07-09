"""Deterministic analytics tests against the saved sample match fixture (no network)."""
from __future__ import annotations

from app.analytics.entries import compute_entries
from app.analytics.maps import compute_maps
from app.analytics.mvp import compute_mvp
from app.analytics.players import compute_players
from app.analytics.report import build_report
from app.analytics.sides import compute_sides
from app.analytics.sites import compute_sites
from app.analytics.trades import compute_trades


def test_context_identifies_our_team(context):
    assert context.our_team_id == "Red"
    assert context.team_won is True
    assert context.our_puuids == {"p1", "p2", "p3", "p4", "p5"}
    # Round 0 anchored to attack (Red planted); both rounds are first-half attack.
    assert context.round_sides == {0: "attack", 1: "attack"}


def test_entries(data):
    e = compute_entries(data)
    # Round 0: p1 gets the first kill (win). Round 1: p1 is first to die (loss).
    assert e["opening_duels"] == 2
    assert e["opening_duel_win_rate"] == 50.0
    assert e["per_player"]["p1"]["first_kills"] == 1
    assert e["per_player"]["p1"]["first_deaths"] == 1
    assert e["per_player"]["p1"]["entry_win_rate"] == 50.0


def test_trades(data):
    t = compute_trades(data)
    # Both of our deaths (p2 in R0, p1 in R1) had teammates alive and were avenged.
    assert t["total_deaths"] == 2
    assert t["tradeable_deaths"] == 2
    assert t["untradeable_deaths"] == 0
    assert t["traded_deaths"] == 2
    assert t["deaths_traded_rate"] == 100.0
    assert t["per_player"]["p3"]["trade_kills"] == 1
    assert t["per_player"]["p2"]["trade_kills"] == 1


def test_trades_exclude_untradeable_last_man():
    """A last-man-standing death must not count against the trade rate."""
    import json
    from app.analytics.common import build_context
    from app.analytics.rounds import all_breakdowns
    from app.models import MatchV4

    # 2v2 round: e1 kills p1 (teammate p2 alive -> tradeable); p2 avenges by killing e1
    # (p1 traded); then e2 kills p2 (p1 already dead -> last man -> untradeable).
    match = MatchV4.parse({
        "metadata": {"map": {"name": "Bind"}},
        "players": [
            {"puuid": "p1", "team_id": "Red"}, {"puuid": "p2", "team_id": "Red"},
            {"puuid": "e1", "team_id": "Blue"}, {"puuid": "e2", "team_id": "Blue"},
        ],
        "teams": [{"team_id": "Red", "won": False}, {"team_id": "Blue", "won": True}],
        "rounds": [{"id": 0, "winning_team": "Blue", "plant": None}],
        "kills": [
            {"round": 0, "time_in_round_in_ms": 1000, "killer": {"puuid": "e1"}, "victim": {"puuid": "p1"}},
            {"round": 0, "time_in_round_in_ms": 2000, "killer": {"puuid": "p2"}, "victim": {"puuid": "e1"}},
            {"round": 0, "time_in_round_in_ms": 3000, "killer": {"puuid": "e2"}, "victim": {"puuid": "p2"}},
        ],
    })
    ctx = build_context(match, {"p1", "p2"})
    assert ctx is not None
    t = compute_trades(all_breakdowns([ctx], 4000))
    assert t["total_deaths"] == 2          # p1 and p2 both died
    assert t["tradeable_deaths"] == 1      # only p1's death could be traded
    assert t["untradeable_deaths"] == 1    # p2 died last-man-standing
    assert t["traded_deaths"] == 1         # p1 was avenged
    # Rate uses tradeable denominator: 1/1 = 100%, NOT the misleading 1/2 = 50%.
    assert t["deaths_traded_rate"] == 100.0


def test_sites(data):
    s = compute_sites(data)
    # Round 0 is a planted attack round we won.
    assert s["attack"]["plants"] == 1
    assert s["attack"]["post_plant_conversion"] == 100.0
    assert s["attack"]["round_win_rate"] == 50.0


def test_sides_and_economy(context):
    s = compute_sides([context])
    assert s["attack_win_rate"] == 50.0
    assert s["attack_rounds"] == 2
    # R0 full-buy win, R1 eco loss.
    assert s["economy"]["full_buy"]["win_rate"] == 100.0
    assert s["economy"]["eco"]["win_rate"] == 0.0


def test_players(data):
    p = compute_players(data)
    assert "p1" in p
    # ACS = total score / rounds played (5000 / 2).
    assert p["p1"]["acs"] == 2500.0
    assert p["p1"]["kills"] == 20
    assert p["p1"]["agents"][0]["name"] == "Jett"


def test_mvp(data):
    players = compute_players(data)
    entries = compute_entries(data)
    trades = compute_trades(data)
    mvp = compute_mvp(players, entries, trades)
    assert len(mvp["ranking"]) == 5
    assert mvp["mvp"] is not None
    assert 0.0 <= mvp["mvp"]["rating"] <= 100.0
    # p1 has the highest raw score, so is the "official" MVP.
    assert mvp["official_mvp"]["puuid"] == "p1"


def test_maps(context):
    m = compute_maps([context])
    assert m["maps"]["Ascent"]["games"] == 1
    assert m["maps"]["Ascent"]["wins"] == 1
    assert "Jett" in m["agents"]


def test_build_match_analysis(match):
    from app.analytics.match_analysis import build_match_analysis

    a = build_match_analysis(match, "team-123", 4000)
    assert a is not None
    assert a["our_team_id"] == "Red"
    assert len(a["players"]) == 10                       # both teams
    assert a["mvp"] is not None and len(a["mvp"]["ranking"]) == 10

    p1 = next(p for p in a["players"] if p["puuid"] == "p1")
    # ability_casts grenade 6 over 2 rounds -> 3.0/round; total (6+8+4+2)=20 -> 10.0/round.
    assert p1["utility"]["per_round"]["grenade"] == 3.0
    assert p1["utility"]["total_per_round"] == 10.0
    # headshots 30 of (30+60+10)=100 -> 30.0%.
    assert p1["hs_pct"] == 30.0
    assert p1["team"] == "Red"
    assert p1["agent"]["name"] == "Jett"
    assert p1["impact_rating"] is not None


def test_match_analysis_positions_and_sites(match):
    from app.analytics.match_analysis import build_match_analysis

    a = build_match_analysis(match, "team-123", 4000)
    pos = a["positions"]
    # Our deaths: p2 (R0) and p1 (R1). Our kills: p1->e1, p3->e2 (R0), p2->e1 (R1).
    assert len(pos["deaths"]) == 2
    assert len(pos["kills"]) == 3
    assert len(pos["plants"]) == 1
    assert pos["plants"][0]["site"] == "A"
    assert pos["plants"][0]["x"] == 5487
    assert pos["deaths"][0]["side"] == "attack"

    st = a["site_tendencies"]
    assert st["total_plants"] == 1
    assert st["avg_plant_time_s"] == 30.0
    assert st["attack_sites"]["A"]["plants"] == 1
    assert st["attack_sites"]["A"]["win_rate"] == 100.0
    assert st["retake_sites"] == {}     # both rounds were attack side


def test_build_report(team, match):
    report = build_report(team, [match])
    assert report["matches_analyzed"] == 1
    assert report["record"] == {"wins": 1, "losses": 0}
    assert report["mvp"]["mvp"] is not None
    assert len(report["callouts"]) >= 1
