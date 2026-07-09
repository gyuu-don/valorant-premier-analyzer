"""Trade analysis: how often our deaths are avenged, and who secures trades."""
from __future__ import annotations

from app.analytics.common import MatchContext, pct
from app.analytics.rounds import RoundBreakdown


def compute_trades(
    data: list[tuple[MatchContext, list[RoundBreakdown]]]
) -> dict:
    total_deaths = tradeable_deaths = traded_deaths = 0
    per_player: dict[str, dict] = {}

    def _row() -> dict:
        return {"deaths": 0, "tradeable_deaths": 0, "deaths_traded": 0, "trade_kills": 0}

    for _ctx, rounds in data:
        for rb in rounds:
            total_deaths += len(rb.deaths)
            tradeable_deaths += len(rb.tradeable_deaths)
            traded_deaths += len(rb.traded_deaths)
            for puuid in rb.deaths:
                pp = per_player.setdefault(puuid, _row())
                pp["deaths"] += 1
                if puuid in rb.tradeable_deaths:
                    pp["tradeable_deaths"] += 1
                if puuid in rb.traded_deaths:
                    pp["deaths_traded"] += 1
            for puuid, n in rb.trade_kills_by_player.items():
                pp = per_player.setdefault(puuid, _row())
                pp["trade_kills"] += n

    for pp in per_player.values():
        # Rate is over tradeable deaths only — last-man-standing deaths are excluded.
        pp["deaths_traded_rate"] = pct(pp["deaths_traded"], pp["tradeable_deaths"])

    return {
        "deaths_traded_rate": pct(traded_deaths, tradeable_deaths),
        "total_deaths": total_deaths,
        "tradeable_deaths": tradeable_deaths,
        "untradeable_deaths": total_deaths - tradeable_deaths,
        "traded_deaths": traded_deaths,
        "per_player": per_player,
    }
