import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchMatch, fetchMatches, type MatchSummary } from "../api";
import { mapImage } from "../maps";
import { ErrorBox, Loading, Section } from "../components/common";

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
  const [matchId, setMatchId] = useState<string>("");

  const {
    data, error, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["matches-infinite"],
    queryFn: ({ pageParam }) => fetchMatches(pageParam, pageParam === 0 ? FIRST_PAGE : NEXT_PAGE),
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
      <div className="page-head"><h1>Match Deep-Dive</h1></div>

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
