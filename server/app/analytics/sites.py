"""Site play: defense holds vs retakes, and attack post-plant conversion."""
from __future__ import annotations

from app.analytics.common import ATTACK, DEFENSE, MatchContext, pct
from app.analytics.rounds import RoundBreakdown


def compute_sites(
    data: list[tuple[MatchContext, list[RoundBreakdown]]]
) -> dict:
    # Defense
    def_rounds = def_wins = 0
    holds = hold_opportunities = 0          # defense rounds with no enemy plant
    retakes = retake_opportunities = 0      # defense rounds where enemy planted

    # Attack
    atk_rounds = atk_wins = 0
    plants = post_plant_wins = 0            # attack rounds where we planted

    for _ctx, rounds in data:
        for rb in rounds:
            if rb.side == DEFENSE:
                def_rounds += 1
                def_wins += int(rb.won)
                if rb.enemy_planted:
                    retake_opportunities += 1
                    retakes += int(rb.won)
                else:
                    hold_opportunities += 1
                    holds += int(rb.won)
            elif rb.side == ATTACK:
                atk_rounds += 1
                atk_wins += int(rb.won)
                if rb.we_planted:
                    plants += 1
                    post_plant_wins += int(rb.won)

    return {
        "defense": {
            "round_win_rate": pct(def_wins, def_rounds),
            "rounds": def_rounds,
            "hold_success_rate": pct(holds, hold_opportunities),
            "hold_opportunities": hold_opportunities,
            "retake_success_rate": pct(retakes, retake_opportunities),
            "retake_opportunities": retake_opportunities,
        },
        "attack": {
            "round_win_rate": pct(atk_wins, atk_rounds),
            "rounds": atk_rounds,
            "post_plant_conversion": pct(post_plant_wins, plants),
            "plants": plants,
        },
    }
