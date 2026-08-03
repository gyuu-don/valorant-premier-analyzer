import { useState } from "react";
import { useReport } from "../hooks";
import { ErrorBox, InfoLabel, Loading, Section } from "../components/common";
import { TeamMvpSection } from "../components/mvp";
import { playerCardImage } from "../media";
import type { PlayerRow } from "../types";
import PlayerProfileSection from "../features/PlayerProfileSection";

const COLS: { key: keyof PlayerRow; label: string; info: string }[] = [
  { key: "acs", label: "ACS", info: "acs" },
  { key: "kd", label: "K/D", info: "kd" },
  { key: "adr", label: "ADR", info: "adr" },
  { key: "kast", label: "KAST%", info: "kast" },
  { key: "hs_pct", label: "HS%", info: "hs_pct" },
  { key: "multikill_rounds", label: "Multikills", info: "multikills" },
  { key: "clutches", label: "Clutches", info: "clutches" },
];

export default function Players() {
  const { data, isLoading, error } = useReport();
  const [selected, setSelected] = useState<string | null>(null);
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const players = (data?.players ?? []).slice().sort((a, b) => b.acs - a.acs);
  if (players.length === 0) return <div className="notice">No player data.</div>;

  const active = players.find((p) => p.puuid === selected) ?? players[0];

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
                <td className="name-cell">
                  <span className="agent-inline">
                    {playerCardImage(p.card)
                      ? <img className="agent-face-sm" src={playerCardImage(p.card)!} alt="" loading="lazy" />
                      : <span className="agent-face-sm agent-face-ph">{p.name[0]}</span>}
                    {p.name}
                  </span>
                </td>
                {COLS.map((c) => <td key={c.label}>{p[c.key] as number}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Click a player to see their profile.</p>
      </Section>

      <PlayerProfileSection player={active} />
    </div>
  );
}

