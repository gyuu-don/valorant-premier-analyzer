"""Overall team situational & timing stats, aggregated across a stage's matches.

Reconstructs each round's alive-count timeline from the ordered kill events to detect
even duels (1v1/2v2), clutch situations (ours and the enemy's), first-blood outcomes,
pistol rounds, and attack plant timing.

Note: alive-count reconstruction is slightly approximate with Sage resurrections (rare);
victims are deduped per round so a re-killed player doesn't double-count.
"""
from __future__ import annotations

from statistics import median

from app.analytics.common import ATTACK, MatchContext, pct

PISTOL_ROUND_INDICES = {0, 12}  # first round of each half


def _kill_time(k) -> int:
    return k.time_in_round_in_ms if k.time_in_round_in_ms is not None else 10**9


def compute_situational(contexts: list[MatchContext]) -> dict:
    # (won, total) accumulators per situation.
    fb_conv = [0, 0]        # rounds we got first blood
    fb_recover = [0, 0]     # rounds we conceded first blood
    d1v1 = [0, 0]
    d2v2 = [0, 0]
    clutch_1vx = [0, 0]     # our last player alive vs >=1 enemy
    enemy_clutch_denied = [0, 0]  # enemy down to last vs >=1 of ours
    pistol = [0, 0]
    plant_times_ms: list[int] = []

    for ctx in contexts:
        match = ctx.match
        our = ctx.our_puuids
        enemy = {p.puuid for p in match.players if p.team_id == ctx.opp_team_id and p.puuid}
        our_n, enemy_n = len(our), len(enemy)

        kills_by_round: dict[int, list] = {}
        for k in match.kills:
            if k.round is not None:
                kills_by_round.setdefault(k.round, []).append(k)
        kill_base = min(kills_by_round) if kills_by_round else 0

        for idx, rnd in enumerate(match.rounds):
            won = rnd.winning_team == ctx.our_team_id if rnd.winning_team else False
            round_kills = sorted(kills_by_round.get(idx + kill_base, []), key=_kill_time)

            if idx in PISTOL_ROUND_INDICES:
                pistol[1] += 1
                pistol[0] += int(won)

            # First blood: earliest kill of the round.
            if round_kills:
                first = round_kills[0]
                if first.killer.puuid in our:
                    fb_conv[1] += 1
                    fb_conv[0] += int(won)
                elif first.victim.puuid in our:
                    fb_recover[1] += 1
                    fb_recover[0] += int(won)

            # Alive-count reconstruction.
            our_dead: set[str] = set()
            enemy_dead: set[str] = set()
            our_alive, enemy_alive = our_n, enemy_n
            hit_1v1 = hit_2v2 = our_last = enemy_last = False
            for k in round_kills:
                v = k.victim.puuid
                if v in our and v not in our_dead:
                    our_dead.add(v)
                    our_alive -= 1
                elif v in enemy and v not in enemy_dead:
                    enemy_dead.add(v)
                    enemy_alive -= 1
                if our_alive == 1 and enemy_alive == 1:
                    hit_1v1 = True
                if our_alive == 2 and enemy_alive == 2:
                    hit_2v2 = True
                if our_alive == 1 and enemy_alive >= 1:
                    our_last = True
                if enemy_alive == 1 and our_alive >= 1:
                    enemy_last = True

            for flag, acc in ((hit_1v1, d1v1), (hit_2v2, d2v2), (our_last, clutch_1vx),
                              (enemy_last, enemy_clutch_denied)):
                if flag:
                    acc[1] += 1
                    acc[0] += int(won)

            # Attack plant timing (rounds we planted).
            plant = rnd.plant
            side = ctx.round_sides.get(idx)
            if side == ATTACK and plant and plant.player.team == ctx.our_team_id and plant.round_time_in_ms:
                plant_times_ms.append(plant.round_time_in_ms)

    def stat(acc: list[int]) -> dict:
        return {"rate": pct(acc[0], acc[1]), "won": acc[0], "total": acc[1]}

    fb_rounds = fb_conv[1] + fb_recover[1]  # rounds that had an opening kill
    return {
        # Share of those rounds where WE drew first blood.
        "first_blood_rate": {"rate": pct(fb_conv[1], fb_rounds), "won": fb_conv[1], "total": fb_rounds},
        "first_blood_conversion": stat(fb_conv),
        "fb_conceded_recovery": stat(fb_recover),
        "rwr_1v1": stat(d1v1),
        "rwr_2v2": stat(d2v2),
        "clutch_1vx": stat(clutch_1vx),
        "enemy_clutch_denied": stat(enemy_clutch_denied),
        "pistol_win_rate": stat(pistol),
        "median_plant_time_s": round(median(plant_times_ms) / 1000, 1) if plant_times_ms else None,
        "plant_time_rounds": len(plant_times_ms),
    }
