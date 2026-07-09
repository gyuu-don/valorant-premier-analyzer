import { useQuery } from "@tanstack/react-query";
import { useReport } from "../hooks";
import { fetchAgentIcons } from "../agents";
import { ErrorBox, InfoLabel, Loading, Section, WinRateBar } from "../components/common";

export default function MapsAgents() {
  const { data, isLoading, error } = useReport();
  const agentIcons = useQuery({
    queryKey: ["agent-icons"],
    queryFn: fetchAgentIcons,
    staleTime: Infinity,
  });
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const maps = Object.entries(data?.maps ?? {});
  const agents = Object.entries(data?.agents ?? {});
  const icons = agentIcons.data;

  return (
    <div className="page">
      <div className="page-head"><h1>Maps & Agents</h1></div>

      <Section title="Map performance">
        <table className="data-table">
          <thead>
            <tr>
              <th>Map</th>
              <th><InfoLabel k="games">Games</InfoLabel></th>
              <th className="wr-col"><InfoLabel k="win_rate">Win rate</InfoLabel></th>
              <th><InfoLabel k="attack_round_win_rate">Attack RWR</InfoLabel></th>
              <th><InfoLabel k="defense_round_win_rate">Defense RWR</InfoLabel></th>
            </tr>
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
            <tr>
              <th>Agent</th>
              <th><InfoLabel k="games">Games</InfoLabel></th>
              <th className="wr-col"><InfoLabel k="win_rate">Win rate</InfoLabel></th>
            </tr>
          </thead>
          <tbody>
            {agents.map(([name, a]) => {
              const icon = icons?.[name.toLowerCase()];
              return (
                <tr key={name}>
                  <td className="name-cell">
                    <span className="agent-inline">
                      {icon
                        ? <img className="agent-face-sm" src={icon} alt={name} loading="lazy" />
                        : <span className="agent-face-sm agent-face-ph">{name[0]}</span>}
                      {name}
                    </span>
                  </td>
                  <td>{a.games}</td>
                  <td className="wr-col"><WinRateBar pct={a.win_rate} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
