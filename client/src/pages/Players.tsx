import { useState } from "react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useReport } from "../hooks";
import { fetchAgentIcons } from "../agents";
import { ErrorBox, InfoLabel, Loading, Section } from "../components/common";
import { TeamMvpSection } from "../components/mvp";
import type { PlayerRow } from "../types";

const COLS: { key: keyof PlayerRow; label: string; info: string }[] = [
  { key: "acs", label: "ACS", info: "acs" },
  { key: "kd", label: "K/D", info: "kd" },
  { key: "adr", label: "ADR", info: "adr" },
  { key: "kast", label: "KAST%", info: "kast" },
  { key: "hs_pct", label: "HS%", info: "hs_pct" },
  { key: "multikill_rounds", label: "Multikills", info: "multikills" },
  { key: "clutches", label: "Clutches", info: "clutches" },
];

// Rough per-metric maxima used to scale the radar to 0..100.
const RADAR_MAX: Record<string, number> = {
  ACS: 300, "K/D": 2, ADR: 200, "KAST%": 100, "HS%": 40,
};

export default function Players() {
  const { data, isLoading, error } = useReport();
  const agentIcons = useQuery({
    queryKey: ["agent-icons"],
    queryFn: fetchAgentIcons,
    staleTime: Infinity,
  });
  const [selected, setSelected] = useState<string | null>(null);
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const players = (data?.players ?? []).slice().sort((a, b) => b.acs - a.acs);
  if (players.length === 0) return <div className="notice">No player data.</div>;

  const active = players.find((p) => p.puuid === selected) ?? players[0];
  const radarData = [
    { metric: "ACS", v: scale(active.acs, RADAR_MAX["ACS"]) },
    { metric: "K/D", v: scale(active.kd, RADAR_MAX["K/D"]) },
    { metric: "ADR", v: scale(active.adr, RADAR_MAX["ADR"]) },
    { metric: "KAST%", v: active.kast },
    { metric: "HS%", v: scale(active.hs_pct, RADAR_MAX["HS%"]) },
  ];

  return (
    <div className="page">
      <div className="page-head"><h1>Player Performance</h1></div>
      {data?.mvp && <TeamMvpSection mvp={data.mvp} />}
      <Section title="Roster stats">
        <table className="data-table">
          <thead>
            <tr>
              <th>Player</th>
              {COLS.map((c) => <th key={c.label}><InfoLabel k={c.info}>{c.label}</InfoLabel></th>)}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.puuid}
                className={p.puuid === active.puuid ? "selected" : ""}
                onClick={() => setSelected(p.puuid)}
              >
                <td className="name-cell">{p.name}</td>
                {COLS.map((c) => <td key={c.label}>{p[c.key] as number}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Click a player to see their profile.</p>
      </Section>

      <Section title={`Profile — ${active.name}`}>
        <div className="profile">
          <div className="radar-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#333" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#aab", fontSize: 12 }} />
                <Radar dataKey="v" stroke="#ff4655" fill="#ff4655" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="profile-stats">
            <div><span>Kills / Deaths / Assists</span><strong>{active.kills} / {active.deaths} / {active.assists}</strong></div>
            <div><span>Rounds played</span><strong>{active.rounds_played}</strong></div>
            <div><span>Multikill rounds</span><strong>{active.multikill_rounds}</strong></div>
            <div><span>Clutches</span><strong>{active.clutches}</strong></div>
          </div>
        </div>
      </Section>

      <Section title="Agents played" note="Pick rate = share of this player's games on each agent.">
        <AgentUsage agents={active.agents} icons={agentIcons.data} />
      </Section>
    </div>
  );
}

function AgentUsage({
  agents,
  icons,
}: {
  agents: { name: string; games: number }[];
  icons?: Record<string, string>;
}) {
  if (!agents || agents.length === 0) return <div className="subtle">No agent data.</div>;
  const total = agents.reduce((s, a) => s + a.games, 0) || 1;
  return (
    <div className="agent-usage">
      {agents.map((a) => {
        const pct = Math.round((100 * a.games) / total);
        const icon = icons?.[a.name.toLowerCase()];
        return (
          <div className="agent-row" key={a.name}>
            <div className="agent-face">
              {icon ? <img src={icon} alt={a.name} loading="lazy" /> : <span className="agent-face-ph">{a.name[0]}</span>}
            </div>
            <div className="agent-meta">
              <div className="agent-name">
                {a.name} <span className="subtle">· {a.games} {a.games === 1 ? "game" : "games"}</span>
              </div>
              <div className="pick">
                <div className="pick-bar"><div className="pick-fill" style={{ width: `${pct}%` }} /></div>
                <span className="pick-pct">{pct}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function scale(v: number, max: number) {
  return Math.round(Math.min(100, (100 * v) / max));
}
