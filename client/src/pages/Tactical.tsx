import { useReport } from "../hooks";
import { ErrorBox, InfoLabel, Loading, Section, StatCard, WinRateBar } from "../components/common";

const TRADE_PHASES: { key: string; slug: string }[] = [
  { key: "attack_preplant", slug: "trade_attack_preplant" },
  { key: "attack_postplant", slug: "trade_attack_postplant" },
  { key: "defense_retake", slug: "trade_defense_retake" },
  { key: "defense_hold", slug: "trade_defense_hold" },
];

export default function Tactical() {
  const { data, isLoading, error } = useReport();
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data || data.matches_analyzed === 0)
    return <div className="notice">No tactical data.</div>;

  const { entries, trades, sites, callouts, baseline } = data;

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
        <StatCard label={<InfoLabel k="opening_duel">Opening-duel win rate</InfoLabel>} value={`${entries?.opening_duel_win_rate ?? 0}%`}
          sub={eGrade.sub || `${entries?.opening_duels ?? 0} duels`} tone={eGrade.tone} />
        <StatCard label={<InfoLabel k="deaths_traded_rate">Deaths traded</InfoLabel>} value={`${trades?.deaths_traded_rate ?? 0}%`}
          sub={`${tGrade.sub} · ${trades?.untradeable_deaths ?? 0} untradeable excl.`} tone={tGrade.tone} />
        <StatCard label={<InfoLabel k="retake_success">Retake success</InfoLabel>} value={`${sites?.defense.retake_success_rate ?? 0}%`}
          sub={rGrade.sub || `${sites?.defense.retake_opportunities ?? 0} retakes`} tone={rGrade.tone} />
        <StatCard label={<InfoLabel k="post_plant_conversion">Post-plant conversion</InfoLabel>} value={`${sites?.attack.post_plant_conversion ?? 0}%`}
          sub={pGrade.sub || `${sites?.attack.plants ?? 0} plants`} tone={pGrade.tone} />
      </div>

      <Section title="Entry duels by player">
        <table className="data-table">
          <thead><tr>
            <th>Player</th>
            <th><InfoLabel k="first_kills">First kills</InfoLabel></th>
            <th><InfoLabel k="first_deaths">First deaths</InfoLabel></th>
            <th><InfoLabel k="entry_win_rate">Entry win %</InfoLabel></th>
          </tr></thead>
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
          <thead><tr>
            <th>Player</th>
            <th><InfoLabel k="deaths">Deaths</InfoLabel></th>
            <th><InfoLabel k="tradeable_deaths">Tradeable</InfoLabel></th>
            <th>Deaths traded</th>
            <th><InfoLabel k="deaths_traded_rate">Traded %</InfoLabel></th>
            <th><InfoLabel k="trade_kills">Trade kills</InfoLabel></th>
          </tr></thead>
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

      {trades?.by_phase && (
        <Section
          title="Trades by game state"
          note="Subsets of the overall trade rate. Defense holds are expected to run lower — site anchors often die solo by design, so read that row as context rather than a failure."
        >
          <table className="data-table">
            <thead><tr>
              <th>Phase</th>
              <th>Traded</th>
              <th><InfoLabel k="tradeable_deaths">Tradeable</InfoLabel></th>
              <th className="wr-col"><InfoLabel k="deaths_traded_rate">Traded %</InfoLabel></th>
            </tr></thead>
            <tbody>
              {TRADE_PHASES.map(({ key, slug }) => {
                const v = trades.by_phase![key] ?? { tradeable: 0, traded: 0, rate: 0 };
                return (
                  <tr key={key}>
                    <td className="name-cell"><InfoLabel k={slug} /></td>
                    <td>{v.traded}</td>
                    <td>{v.tradeable}</td>
                    <td className="wr-col"><WinRateBar pct={v.rate} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

function nameOf(data: any, puuid: string): string {
  const p = (data.players ?? []).find((x: any) => x.puuid === puuid);
  return p?.name ?? puuid;
}
