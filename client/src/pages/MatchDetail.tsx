import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMatch, fetchTeamHistory } from "../api";
import { ErrorBox, Loading, Section } from "../components/common";

export default function MatchDetail() {
  const history = useQuery({ queryKey: ["history"], queryFn: fetchTeamHistory });
  const [matchId, setMatchId] = useState<string>("");

  const match = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => fetchMatch(matchId),
    enabled: !!matchId,
  });

  const options: { id: string; label: string }[] =
    history.data?.history
      ?.map((h: any) => ({
        id: h.match_id ?? h.id,
        label: `${h.match_id ?? h.id}${h.started_at ? ` · ${h.started_at}` : ""}`,
      }))
      .filter((o: any) => o.id) ?? [];

  return (
    <div className="page">
      <div className="page-head"><h1>Match Deep-Dive</h1></div>

      <Section title="Select a match">
        {history.isLoading && <span className="subtle">Loading match list…</span>}
        {history.error && <ErrorBox error={history.error} />}
        <div className="match-picker">
          <select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
            <option value="">— choose a Premier match —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <input
            placeholder="…or paste a match ID"
            value={matchId}
            onChange={(e) => setMatchId(e.target.value.trim())}
          />
        </div>
      </Section>

      {matchId && match.isLoading && <Loading />}
      {match.error && <ErrorBox error={match.error} />}
      {match.data && <MatchView data={match.data} />}
    </div>
  );
}

function MatchView({ data }: { data: any }) {
  const players = [...(data.players ?? [])].sort(
    (a: any, b: any) => (b.stats?.score ?? 0) - (a.stats?.score ?? 0)
  );
  const rounds = data.rounds ?? [];

  return (
    <>
      <Section title={`${data.metadata?.map?.name ?? "Match"} — scoreboard`}>
        <table className="data-table">
          <thead>
            <tr><th>Player</th><th>Team</th><th>Agent</th><th>K</th><th>D</th><th>A</th><th>Score</th></tr>
          </thead>
          <tbody>
            {players.map((p: any) => (
              <tr key={p.puuid}>
                <td className="name-cell">{p.name}#{p.tag}</td>
                <td className={`team-${(p.team_id ?? "").toLowerCase()}`}>{p.team_id}</td>
                <td>{p.agent?.name}</td>
                <td>{p.stats?.kills}</td>
                <td>{p.stats?.deaths}</td>
                <td>{p.stats?.assists}</td>
                <td>{p.stats?.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Round-by-round">
        <div className="round-timeline">
          {rounds.map((r: any, i: number) => (
            <div key={i} className={`round-cell win-${(r.winning_team ?? "").toLowerCase()}`}>
              <div className="round-num">R{i + 1}</div>
              <div className="round-winner">{r.winning_team ?? "?"}</div>
              {r.plant?.site && <div className="round-plant">plant {r.plant.site}</div>}
            </div>
          ))}
        </div>
        <p className="hint">Cell color = round winner (Red / Blue). "plant" marks the bomb site.</p>
      </Section>
    </>
  );
}
