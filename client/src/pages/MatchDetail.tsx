import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchMatch, fetchMatches, type MatchSummary } from "../api";
import { fetchAgents, type AgentInfo } from "../agents";
import { mapImage } from "../maps";
import { useSeason } from "../season";
import { ErrorBox, Loading, Section } from "../components/common";
import { COMPONENT_LABELS, MvpRanking } from "../components/mvp";
import type { MatchAnalysis, MatchPlayerAnalysis } from "../types";

const UTIL_SLOTS: { key: string; fallback: string }[] = [
  { key: "grenade", fallback: "Grenade" },
  { key: "ability1", fallback: "Ability 1" },
  { key: "ability2", fallback: "Ability 2" },
  { key: "ultimate", fallback: "Ultimate" },
];

const FIRST_PAGE = 10;
const NEXT_PAGE = 5;

function fmtDate(d?: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function MatchCard({
  m,
  selected,
  onSelect,
}: {
  m: MatchSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const img = mapImage(m.map);
  const bg = img
    ? `linear-gradient(90deg, rgba(15,17,21,0.55), rgba(15,17,21,0.9)), url(${img})`
    : undefined;
  return (
    <button
      type="button"
      className={`match-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
      style={bg ? { backgroundImage: bg } : undefined}
    >
      <div className="mc-body">
        <div className="mc-date">{fmtDate(m.started_at)}</div>
        <div className="mc-opp">vs {m.opponent}</div>
        <div className="mc-map">{m.map}</div>
      </div>
      <div className={`mc-result ${m.result === "W" ? "win" : "loss"}`}>
        <span className="mc-wl">{m.result}</span>
        <span className="mc-score">{m.score}</span>
      </div>
    </button>
  );
}

export default function MatchDetail() {
  const { season } = useSeason();
  const [matchId, setMatchId] = useState<string>("");

  const {
    data, error, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["matches-infinite", season],
    queryFn: ({ pageParam }) =>
      fetchMatches(pageParam, pageParam === 0 ? FIRST_PAGE : NEXT_PAGE, season),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.next_offset : undefined),
  });

  const items = (data?.pages.flatMap((p) => p.matches) ?? []).filter((m) => m.match_id);

  // Load more when the sentinel at the bottom of the list scrolls into view.
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { root: listRef.current, rootMargin: "80px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const match = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => fetchMatch(matchId),
    enabled: !!matchId,
  });

  return (
    <div className="page">
      <div className="page-head"><h1>Match Analysis</h1></div>

      <Section title="Select a match" note="Most recent first — scroll to load older matches.">
        {isLoading && <span className="subtle">Loading match list…</span>}
        {error && <ErrorBox error={error} />}
        <div className="match-list" ref={listRef}>
          {items.map((m) => (
            <MatchCard
              key={m.match_id}
              m={m}
              selected={m.match_id === matchId}
              onSelect={() => setMatchId(m.match_id)}
            />
          ))}
          <div ref={sentinelRef} className="match-list-sentinel">
            {isFetchingNextPage
              ? "Loading more…"
              : hasNextPage
              ? "Scroll for more"
              : items.length > 0
              ? "No more matches"
              : ""}
          </div>
        </div>
      </Section>

      {matchId && match.isLoading && <Loading />}
      {match.error && <ErrorBox error={match.error} />}
      {match.data && <MatchView data={match.data} />}
    </div>
  );
}

function MatchView({ data }: { data: any }) {
  const agents = useQuery({ queryKey: ["agents-full"], queryFn: fetchAgents, staleTime: Infinity });
  const players = [...(data.players ?? [])].sort(
    (a: any, b: any) => (b.stats?.score ?? 0) - (a.stats?.score ?? 0)
  );
  const rounds = data.rounds ?? [];
  const analysis: MatchAnalysis | null = data.analysis ?? null;
  const byPuuid = new Map((analysis?.players ?? []).map((p) => [p.puuid, p]));

  // Default the player card to our team's match MVP, else the top scoreboard player.
  const ourTeamRanking = (analysis?.mvp?.ranking ?? []).filter(
    (r) => byPuuid.get(r.puuid)?.team === analysis?.our_team_id
  );
  const defaultPuuid = ourTeamRanking[0]?.puuid ?? players[0]?.puuid ?? null;
  const [sel, setSel] = useState<string | null>(null);
  const selectedPuuid = sel ?? defaultPuuid;
  const selected = selectedPuuid ? byPuuid.get(selectedPuuid) ?? null : null;

  return (
    <>
      <Section title={`${data.metadata?.map?.name ?? "Match"} — scoreboard`} note="Click a player for their game breakdown.">
        <table className="data-table">
          <thead>
            <tr><th>Player</th><th>Team</th><th>Agent</th><th>K</th><th>D</th><th>A</th><th>Score</th></tr>
          </thead>
          <tbody>
            {players.map((p: any) => (
              <tr
                key={p.puuid}
                className={p.puuid === selectedPuuid ? "selected" : ""}
                onClick={() => setSel(p.puuid)}
                style={{ cursor: "pointer" }}
              >
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

      {selected && (
        <Section title={`Player breakdown — ${selected.name} (this game)`}>
          <PlayerCard p={selected} agentInfo={agents.data?.[(selected.agent.name ?? "").toLowerCase()]} />
        </Section>
      )}

      {ourTeamRanking.length > 0 && (
        <Section title="Advanced Team MVP — this match" note="Impact rating computed from this game only, normalized across the lobby.">
          <MvpRanking
            ranking={ourTeamRanking}
            weights={analysis?.mvp?.weights}
            weightTotal={analysis?.mvp?.weight_total}
          />
        </Section>
      )}

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

function PlayerCard({ p, agentInfo }: { p: MatchPlayerAnalysis; agentInfo?: AgentInfo }) {
  const stats: { label: string; value: string | number }[] = [
    { label: "ACS", value: p.acs },
    { label: "ADR", value: p.adr },
    { label: "HS%", value: `${p.hs_pct}%` },
    { label: "K / D / A", value: `${p.kills} / ${p.deaths} / ${p.assists}` },
    { label: "KAST", value: `${p.kast}%` },
    { label: "First bloods", value: p.first_kills },
    { label: "Multikills", value: p.multikill_rounds },
    { label: "Clutches", value: p.clutches },
  ];
  const maxPr = Math.max(0.01, ...UTIL_SLOTS.map((s) => p.utility.per_round[s.key] ?? 0));

  return (
    <div className="player-card">
      <div className="pc-header">
        {agentInfo?.icon ? (
          <img className="pc-agent" src={agentInfo.icon} alt={p.agent.name ?? ""} />
        ) : (
          <div className="pc-agent pc-agent-ph">{(p.agent.name ?? "?")[0]}</div>
        )}
        <div className="pc-title">
          <div className="pc-name">{p.name}</div>
          <div className="subtle">
            {p.agent.name ?? "Unknown agent"} · <span className={`team-${p.team.toLowerCase()}`}>{p.team}</span>
          </div>
        </div>
        {p.impact_rating != null && (
          <div className="pc-impact">
            <div className="pc-impact-val">{p.impact_rating}</div>
            <div className="stat-label">Impact (this game)</div>
          </div>
        )}
      </div>

      <div className="pc-stats">
        {stats.map((s) => (
          <div className="pc-stat" key={s.label}>
            <div className="pc-stat-val">{s.value}</div>
            <div className="pc-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="pc-sections">
        <div className="pc-section">
          <h4>Utility usage / round</h4>
          {UTIL_SLOTS.map((s) => {
            const ability = agentInfo?.abilities?.[s.key];
            const val = p.utility.per_round[s.key] ?? 0;
            return (
              <div className="util-row" key={s.key}>
                {ability?.icon
                  ? <img className="util-ic" src={ability.icon} alt={ability.name} />
                  : <span className="util-ic util-ic-ph" />}
                <span className="util-name">{ability?.name ?? s.fallback}</span>
                <div className="pick-bar util-bar">
                  <div className="pick-fill" style={{ width: `${(100 * val) / maxPr}%` }} />
                </div>
                <span className="util-val">{val}</span>
              </div>
            );
          })}
          <div className="util-total">Total utility: <strong>{p.utility.total_per_round}</strong> casts/round</div>
        </div>

        <div className="pc-section">
          <h4>Impact breakdown (normalized 0–1)</h4>
          <ul className="impact-breakdown">
            {Object.entries(COMPONENT_LABELS).map(([k, label]) => (
              <li key={k}>
                <span>{label}</span>
                <span className="ib-val">{(p.impact_components[k] ?? 0).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
