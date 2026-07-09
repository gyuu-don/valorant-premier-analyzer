import { useReport } from "../hooks";
import { ErrorBox, Loading, Section, WinRateBar } from "../components/common";

export default function MapsAgents() {
  const { data, isLoading, error } = useReport();
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const maps = Object.entries(data?.maps ?? {});
  const agents = Object.entries(data?.agents ?? {});

  return (
    <div className="page">
      <div className="page-head"><h1>Maps & Agents</h1></div>

      <Section title="Map performance">
        <table className="data-table">
          <thead>
            <tr><th>Map</th><th>Games</th><th className="wr-col">Win rate</th><th>Attack RWR</th><th>Defense RWR</th></tr>
          </thead>
          <tbody>
            {maps.map(([name, m]) => (
              <tr key={name}>
                <td className="name-cell">{name}</td>
                <td>{m.games} ({m.wins}W)</td>
                <td className="wr-col"><WinRateBar pct={m.win_rate} /></td>
                <td>{m.attack_round_win_rate}%</td>
                <td>{m.defense_round_win_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Agent usage">
        <table className="data-table">
          <thead>
            <tr><th>Agent</th><th>Games</th><th className="wr-col">Win rate</th></tr>
          </thead>
          <tbody>
            {agents.map(([name, a]) => (
              <tr key={name}>
                <td className="name-cell">{name}</td>
                <td>{a.games}</td>
                <td className="wr-col"><WinRateBar pct={a.win_rate} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
