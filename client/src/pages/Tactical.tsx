import { useReport } from "../hooks";
import { ErrorBox, Loading, Section, StatCard } from "../components/common";

export default function Tactical() {
  const { data, isLoading, error } = useReport();
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data || data.matches_analyzed === 0)
    return <div className="notice">No tactical data.</div>;

  const { entries, trades, sites, utility, callouts } = data;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Tactical Breakdown</h1>
        <div className="subtle">Where the team can improve: entries, trades, site play & utility.</div>
      </div>

      <Section title="Coaching callouts">
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
          sub={`${entries?.opening_duels ?? 0} duels`}
          tone={(entries?.opening_duel_win_rate ?? 0) >= 50 ? "good" : "bad"} />
        <StatCard label="Deaths traded" value={`${trades?.deaths_traded_rate ?? 0}%`}
          sub={`${trades?.traded_deaths ?? 0}/${trades?.total_deaths ?? 0}`}
          tone={(trades?.deaths_traded_rate ?? 0) >= 55 ? "good" : "bad"} />
        <StatCard label="Retake success" value={`${sites?.defense.retake_success_rate ?? 0}%`}
          sub={`${sites?.defense.retake_opportunities ?? 0} retakes`}
          tone={(sites?.defense.retake_success_rate ?? 0) >= 40 ? "good" : "bad"} />
        <StatCard label="Post-plant conversion" value={`${sites?.attack.post_plant_conversion ?? 0}%`}
          sub={`${sites?.attack.plants ?? 0} plants`}
          tone={(sites?.attack.post_plant_conversion ?? 0) >= 70 ? "good" : "bad"} />
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

      <Section title="Trades by player">
        <table className="data-table">
          <thead><tr><th>Player</th><th>Deaths</th><th>Deaths traded</th><th>Traded %</th><th>Trade kills</th></tr></thead>
          <tbody>
            {Object.entries(trades?.per_player ?? {}).map(([puuid, t]) => (
              <tr key={puuid}>
                <td className="name-cell">{nameOf(data, puuid)}</td>
                <td>{t.deaths}</td>
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
