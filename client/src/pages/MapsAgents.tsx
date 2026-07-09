import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReport } from "../hooks";
import { useSeason } from "../season";
import { fetchAgentIcons } from "../agents";
import { fetchMapDetail } from "../api";
import { fetchMaps } from "../maps";
import { ErrorBox, InfoLabel, Loading, Section, WinRateBar } from "../components/common";
import { Heatmap } from "../components/heatmap";

const ALL = "all";

export default function MapsAgents() {
  const { data, isLoading, error } = useReport();
  const { season } = useSeason();
  const agentIcons = useQuery({ queryKey: ["agent-icons"], queryFn: fetchAgentIcons, staleTime: Infinity });
  const mapsCal = useQuery({ queryKey: ["maps-cal"], queryFn: fetchMaps, staleTime: Infinity });
  const mapDetail = useQuery({ queryKey: ["map-detail", season], queryFn: () => fetchMapDetail(season) });
  const [selectedMap, setSelectedMap] = useState<string>(ALL);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const icons = agentIcons.data;
  const maps = Object.entries(data?.maps ?? {});
  const roster = (data?.players ?? []).map((p) => ({ puuid: p.puuid, name: p.name }));

  // "All Maps" aggregate row (from the report's record + overall side splits).
  const allGames = data?.matches_analyzed ?? 0;
  const allWins = data?.record?.wins ?? 0;
  const allWinRate = allGames ? Math.round((100 * allWins) / allGames) : 0;

  // Agent usage: global for "all", else the selected map's usage.
  const agents =
    selectedMap === ALL
      ? Object.entries(data?.agents ?? {})
      : Object.entries(mapDetail.data?.maps[selectedMap]?.agents ?? {});

  const rowClass = (name: string) => (selectedMap === name ? "selected" : "");

  return (
    <div className="page">
      <div className="page-head">
        <h1>Maps & Agents</h1>
        <div className="subtle">Select a map to see its cumulative heatmap and agent usage for the stage.</div>
      </div>

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
            <tr className={rowClass(ALL)} onClick={() => setSelectedMap(ALL)} style={{ cursor: "pointer" }}>
              <td className="name-cell">All Maps</td>
              <td>{allGames} ({allWins}W)</td>
              <td className="wr-col"><WinRateBar pct={allWinRate} /></td>
              <td>{data?.sides?.attack_win_rate ?? 0}%</td>
              <td>{data?.sides?.defense_win_rate ?? 0}%</td>
            </tr>
            {maps.map(([name, m]) => (
              <tr key={name} className={rowClass(name)} onClick={() => setSelectedMap(name)} style={{ cursor: "pointer" }}>
                <td className="name-cell">{name}</td>
                <td>{m.games} ({m.wins}W)</td>
                <td className="wr-col"><WinRateBar pct={m.win_rate} /></td>
                <td>{m.attack_round_win_rate}%</td>
                <td>{m.defense_round_win_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Click a map row to filter the heatmap and agent usage below.</p>
      </Section>

      <Section
        title={selectedMap === ALL ? "Heatmap" : `Heatmap — ${selectedMap}`}
        note="Cumulative kills & deaths across all matches on this map in the selected stage."
      >
        {selectedMap === ALL ? (
          <div className="subtle">Select a specific map above to view its cumulative heatmap (maps can't be combined onto one minimap).</div>
        ) : mapDetail.isLoading ? (
          <span className="subtle">Loading positions…</span>
        ) : mapDetail.data?.maps[selectedMap] ? (
          <Heatmap
            positions={mapDetail.data.maps[selectedMap].positions}
            mapName={selectedMap}
            cal={mapsCal.data?.[selectedMap.toLowerCase()]}
            players={roster}
          />
        ) : (
          <div className="subtle">No position data for {selectedMap}.</div>
        )}
      </Section>

      <Section title={selectedMap === ALL ? "Agent usage — all maps" : `Agent usage — ${selectedMap}`}>
        {agents.length === 0 ? (
          <div className="subtle">No agent data{selectedMap === ALL ? "" : ` for ${selectedMap}`}.</div>
        ) : (
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
        )}
      </Section>
    </div>
  );
}
