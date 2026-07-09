"""Per-round breakdown shared by every analyzer.

Parsing kill order once per round yields everything the entry / trade / clutch / KAST /
site logic needs, keeping those modules small and independently testable.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.analytics.common import ATTACK, DEFENSE, MatchContext
from app.models import Kill


def _kill_time(k: Kill) -> int:
    return k.time_in_round_in_ms if k.time_in_round_in_ms is not None else 10**9


def _phase(side: str, death_time_ms: Optional[int], plant_time_ms: Optional[int]) -> str:
    """Classify a death by game state: attack/defense × pre/post plant."""
    post = (
        plant_time_ms is not None
        and death_time_ms is not None
        and death_time_ms >= plant_time_ms
    )
    if side == ATTACK:
        return "attack_postplant" if post else "attack_preplant"
    return "defense_retake" if post else "defense_hold"


@dataclass
class RoundBreakdown:
    index: int
    side: str                       # "attack" / "defense" for our team
    won: bool
    we_planted: bool = False
    enemy_planted: bool = False
    plant_site: str | None = None    # site (e.g., "A", "B") when we_planted is True
    kills_by_player: dict[str, int] = field(default_factory=dict)   # our kills
    assists_by_player: dict[str, int] = field(default_factory=dict)  # our assists
    deaths: set[str] = field(default_factory=set)                   # our players who died
    survivors: set[str] = field(default_factory=set)                # our players alive at end
    first_kill_by_us: Optional[bool] = None                          # True/False/None
    first_killer: Optional[str] = None
    first_victim: Optional[str] = None
    # Deaths where a teammate was still alive to avenge (excludes last-man-standing deaths).
    tradeable_deaths: set[str] = field(default_factory=set)
    traded_deaths: set[str] = field(default_factory=set)            # tradeable deaths that were avenged
    trade_kills_by_player: dict[str, int] = field(default_factory=dict)  # our trade kills
    # Game-state splits of tradeable/traded deaths (team-level), keyed by phase.
    tradeable_by_phase: dict[str, int] = field(default_factory=dict)
    traded_by_phase: dict[str, int] = field(default_factory=dict)
    clutch_puuid: Optional[str] = None


def analyze_rounds(ctx: MatchContext, trade_window_ms: int) -> list[RoundBreakdown]:
    match = ctx.match
    our = ctx.our_puuids

    # Group kills by their round number, normalizing 0- vs 1-based indexing.
    kills_by_round: dict[int, list[Kill]] = {}
    for k in match.kills:
        if k.round is None:
            continue
        kills_by_round.setdefault(k.round, []).append(k)
    kill_base = min(kills_by_round) if kills_by_round else 0

    breakdowns: list[RoundBreakdown] = []
    for idx, rnd in enumerate(match.rounds):
        side = ctx.round_sides.get(idx, "attack")
        won = rnd.winning_team == ctx.our_team_id if rnd.winning_team else False

        we_planted = bool(rnd.plant and rnd.plant.player.team == ctx.our_team_id)
        enemy_planted = bool(rnd.plant and rnd.plant.player.team not in (None, ctx.our_team_id))
        plant_site = rnd.plant.site if we_planted else None

        rb = RoundBreakdown(
            index=idx, side=side, won=won,
            we_planted=we_planted, enemy_planted=enemy_planted,
            plant_site=plant_site,
        )

        round_kills = sorted(kills_by_round.get(idx + kill_base, []), key=_kill_time)

        # Kills / deaths / assists for our players.
        for k in round_kills:
            if ctx.is_ours(k.killer.puuid):
                rb.kills_by_player[k.killer.puuid] = rb.kills_by_player.get(k.killer.puuid, 0) + 1
            if ctx.is_ours(k.victim.puuid):
                rb.deaths.add(k.victim.puuid)
            for a in k.assistants:
                if ctx.is_ours(a.puuid):
                    rb.assists_by_player[a.puuid] = rb.assists_by_player.get(a.puuid, 0) + 1

        rb.survivors = {p for p in our if p not in rb.deaths}

        # Opening duel: first kill event of the round.
        if round_kills:
            first = round_kills[0]
            rb.first_killer = first.killer.puuid
            rb.first_victim = first.victim.puuid
            if ctx.is_ours(first.killer.puuid):
                rb.first_kill_by_us = True
            elif ctx.is_ours(first.victim.puuid):
                rb.first_kill_by_us = False

        # Trades. Walk kills in time order tracking who on our side has already died.
        # A death is only "tradeable" if a teammate was still alive at that moment
        # (a last-man-standing death cannot be traded and is excluded from the rate).
        # It is "traded" if that killer is killed by one of ours within the window.
        plant_time = rnd.plant.round_time_in_ms if rnd.plant else None
        our_dead: set[str] = set()
        for i, k in enumerate(round_kills):
            if not ctx.is_ours(k.victim.puuid):
                continue
            victim_puuid = k.victim.puuid
            teammates_alive = ctx.our_puuids - our_dead - {victim_puuid}
            if teammates_alive:
                phase = _phase(side, k.time_in_round_in_ms, plant_time)
                # Guard phase counts to the first tradeable death per player-round so the
                # splits sum to the set-based overall (a Sage-res player can die twice).
                if victim_puuid not in rb.tradeable_deaths:
                    rb.tradeable_by_phase[phase] = rb.tradeable_by_phase.get(phase, 0) + 1
                rb.tradeable_deaths.add(victim_puuid)
                killer_puuid = k.killer.puuid
                death_time = _kill_time(k)
                for later in round_kills[i + 1:]:
                    if _kill_time(later) - death_time > trade_window_ms:
                        break
                    if later.victim.puuid == killer_puuid and ctx.is_ours(later.killer.puuid):
                        if victim_puuid not in rb.traded_deaths:
                            rb.traded_by_phase[phase] = rb.traded_by_phase.get(phase, 0) + 1
                        rb.traded_deaths.add(victim_puuid)
                        rb.trade_kills_by_player[later.killer.puuid] = (
                            rb.trade_kills_by_player.get(later.killer.puuid, 0) + 1
                        )
                        break
            our_dead.add(victim_puuid)

        # Clutch (heuristic): we won, exactly one teammate survived, and they fragged.
        if won and len(rb.survivors) == 1:
            survivor = next(iter(rb.survivors))
            if rb.kills_by_player.get(survivor, 0) >= 1:
                rb.clutch_puuid = survivor

        breakdowns.append(rb)

    return breakdowns


def all_breakdowns(
    contexts: list[MatchContext], trade_window_ms: int
) -> list[tuple[MatchContext, list[RoundBreakdown]]]:
    return [(ctx, analyze_rounds(ctx, trade_window_ms)) for ctx in contexts]
