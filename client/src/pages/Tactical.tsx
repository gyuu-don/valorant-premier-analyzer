import { useReport } from "../hooks";
import { ErrorBox, Loading, Section, StatCard } from "../components/common";

export default function Tactical() {
  const { data, isLoading, error } = useReport();
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data || data.matches_analyzed === 0)
    return <div className="notice">No tactical data.</div>;

  const { entries, trades, sites, utility, callouts, baseline } = data;

  // Grade a metric against the opponent baseline (division norm).
  const vs = (ours: number, theirs?: number) => {
    if (theirs == null) return { sub: "", tone: "neutral" as const };
    const gap = Math.round((ours - theirs) * 10) / 10;
    const arrow = gap >= 5 ? "▲" : gap <= -3 ? "▾" : "≈";
    const tone = gap <= -3 ? ("bad" as const) : gap >= 5 ? ("good" as const) : ("neutral" as const);
    return { sub: `vs ${theirs}% opp ${arrow}`, tone };
  };

  const eGrade = vs(entries?.opening_duel_win_rate ?? 0, baseline?.opening_duel_win_rate);
  const tGrade = vs(trades?.deaths_traded_rate ?? 0, baseline?.deaths_traded_rate);
  const rGrade = vs(sites?.defense.retake_success_rate ?? 0, baseline?.retake_success_rate);
  const pGrade = vs(sites?.attack.post_plant_conversion ?? 0, baseline?.post_plant_conversion);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Tactical Breakdown</h1>
        <div className="subtle">
          Benchmarked against the {baseline?.matches ?? 0} opponents you actually faced — your
          division's true skill level, not an absolute pro benchmark.
        </div>
      </div>

      <Section title="Coaching callouts" note="Graded relative to opponents faced (division norm).">
        <ul className="callouts">
          {(callouts ?? []).map((c, i) => (
            <li key={i} className={`callout ${c.severity}`}>
              <span className="callout-area">{c.area}</span>
              <span className="callout-text">{c.text}</span>
            </li>
          ))}
        </ul>
      </Section>

      <div className="stat-grid">
        <StatCard label="Opening-duel win rate" value={`${entries?.opening_duel_win_rate ?? 0}%`}
          sub={eGrade.sub || `${entries?.opening_duels ?? 0} duels`} tone={eGrade.tone} />
        <StatCard label="Deaths traded" value={`${trades?.deaths_traded_rate ?? 0}%`}
          sub={`${tGrade.sub} · ${trades?.untradeable_deaths ?? 0} untradeable excl.`} tone={tGrade.tone} />
        <StatCard label="Retake success" value={`${sites?.defense.retake_success_rate ?? 0}%`}
          sub={rGrade.sub || `${sites?.defense.retake_opportunities ?? 0} retakes`} tone={rGrade.tone} />
        <StatCard label="Post-plant conversion" value={`${sites?.attack.post_plant_conversion ?? 0}%`}
          sub={pGrade.sub || `${sites?.attack.plants ?? 0} plants`} tone={pGrade.tone} />
      </div>

      <Section title="Entry duels by player">
        <table className="data-table">
          <thead><tr><th>Player</th><th>First kills</th><th>First deaths</th><th>Entry win %</th></tr></thead>
          <tbody>
            {Object.entries(entries?.per_player ?? {}).map(([puuid, e]) => (
              <tr key={puuid}>
                <td className="name-cell">{nameOf(data, puuid)}</td>
                <td>{e.first_kills}</td>
                <td>{e.first_deaths}</td>
                <td>{e.entry_win_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Trades by player" note="Traded % is over tradeable deaths only — last-man-standing deaths (nobody alive to trade) are excluded.">
        <table className="data-table">
          <thead><tr><th>Player</th><th>Deaths</th><th>Tradeable</th><th>Deaths traded</th><th>Traded %</th><th>Trade kills</th></tr></thead>
          <tbody>
            {Object.entries(trades?.per_player ?? {}).map(([puuid, t]) => (
              <tr key={puuid}>
                <td className="name-cell">{nameOf(data, puuid)}</td>
                <td>{t.deaths}</td>
                <td>{t.tradeable_deaths}</td>
                <td>{t.deaths_traded}</td>
                <td>{t.deaths_traded_rate}%</td>
                <td>{t.trade_kills}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Utility effectiveness" note={utility?.note}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Player</th><th>Casts / round</th><th>Grenade</th><th>Ability 1</th>
              <th>Ability 2</th><th>Ultimate</th><th>Assists / round</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(utility?.per_player ?? {}).map(([puuid, u]: [string, any]) => (
              <tr key={puuid}>
                <td className="name-cell">{u.name ?? nameOf(data, puuid)}</td>
                <td>{u.casts_per_round}</td>
                <td>{u.grenade_per_round}</td>
                <td>{u.ability1_per_round}</td>
                <td>{u.ability2_per_round}</td>
                <td>{u.ultimate_per_round}</td>
                <td>{u.assists_per_round}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function nameOf(data: any, puuid: string): string {
  const p = (data.players ?? []).find((x: any) => x.puuid === puuid);
  return p?.name ?? puuid;
}
