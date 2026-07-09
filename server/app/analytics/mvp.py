"""Advanced team MVP: a composite impact rating (distinct from Riot's raw-score MVP).

Each component is min-max normalized across our roster, weighted (config.MVP_WEIGHTS),
and scaled to 0..100. The highest-rated player is the advanced MVP. We also surface the
"official" MVP (highest total combat score) for contrast.
"""
from __future__ import annotations

from app.analytics.common import safe_div
from app.config import MVP_WEIGHTS


def _normalize(values: dict[str, float]) -> dict[str, float]:
    if not values:
        return {}
    lo, hi = min(values.values()), max(values.values())
    if hi == lo:
        return {k: 0.5 for k in values}
    return {k: (v - lo) / (hi - lo) for k, v in values.items()}


def compute_mvp(
    player_rows: dict[str, dict],
    entries: dict,
    trades: dict,
) -> dict:
    if not player_rows:
        return {"ranking": [], "mvp": None, "official_mvp": None}

    entry_pp = entries.get("per_player", {})
    trade_pp = trades.get("per_player", {})

    # Raw component values per player.
    components: dict[str, dict[str, float]] = {
        "acs": {},
        "kast": {},
        "entry_win_rate": {},
        "trade_contribution": {},
        "multikills": {},
        "clutches": {},
        "adr": {},
    }
    for puuid, row in player_rows.items():
        rp = max(row["rounds_played"], 1)
        components["acs"][puuid] = row["acs"]
        components["kast"][puuid] = row["kast"]
        components["adr"][puuid] = row["adr"]
        components["entry_win_rate"][puuid] = entry_pp.get(puuid, {}).get("entry_win_rate", 0.0)
        t = trade_pp.get(puuid, {})
        # Penalize only deaths that *could* have been traded but weren't.
        untraded_deaths = t.get("tradeable_deaths", 0) - t.get("deaths_traded", 0)
        contribution = t.get("trade_kills", 0) - untraded_deaths
        components["trade_contribution"][puuid] = safe_div(contribution, rp)
        components["multikills"][puuid] = safe_div(row["multikill_rounds"], rp)
        components["clutches"][puuid] = safe_div(row["clutches"], rp)

    normalized = {name: _normalize(vals) for name, vals in components.items()}
    weight_total = sum(MVP_WEIGHTS.values()) or 1.0

    ranking = []
    for puuid, row in player_rows.items():
        breakdown = {}
        score = 0.0
        for comp, weight in MVP_WEIGHTS.items():
            n = normalized[comp].get(puuid, 0.0)
            breakdown[comp] = round(n, 3)
            score += weight * n
        rating = round(100.0 * score / weight_total, 1)
        ranking.append(
            {
                "puuid": puuid,
                "name": row["name"],
                "rating": rating,
                "components": breakdown,
            }
        )

    ranking.sort(key=lambda r: -r["rating"])
    official_mvp_puuid = max(player_rows, key=lambda p: player_rows[p]["score"])

    return {
        "ranking": ranking,
        "mvp": ranking[0] if ranking else None,
        "official_mvp": {
            "puuid": official_mvp_puuid,
            "name": player_rows[official_mvp_puuid]["name"],
            "score": player_rows[official_mvp_puuid]["score"],
        },
        # Weights + weight_total let the client reconstruct each player's exact
        # rating: 100 * Σ(weight * normalized_component) / weight_total.
        "weights": dict(MVP_WEIGHTS),
        "weight_total": round(weight_total, 4),
        "method": (
            "Composite of ACS, KAST, entry win rate, trade contribution, multikills, "
            "clutches and ADR — each min-max normalized across the roster and weighted."
        ),
    }
