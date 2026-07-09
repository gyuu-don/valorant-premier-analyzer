import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchMatch, fetchMatches, type MatchSummary } from "../api";
import { fetchAgents, type AgentInfo } from "../agents";
import { mapImage, fetchMaps, toMinimap, type MapCalibration } from "../maps";
import { useSeason } from "../season";
import { ErrorBox, InfoLabel, Loading, Section, WinRateBar } from "../components/common";
import { COMPONENT_LABELS, MvpRanking } from "../components/mvp";
import type { MatchAnalysis, MatchPlayerAnalysis } from "../types";

const HEAT_SIZE = 680;
const LAYER_COLORS: Record<string, string> = {
  deaths: "248,113,113",
  kills: "74,222,128",
  plants: "74,168,255",
};

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
      {match.data && <MatchView key={matchId} data={match.data} />}
    </div>
  );
}

function MatchView({ data }: { data: any }) {
  const agents = useQuery({ queryKey: ["agents-full"], queryFn: fetchAgents, staleTime: Infinity });
  const maps = useQuery({ queryKey: ["maps-cal"], queryFn: fetchMaps, staleTime: Infinity });
  const mapName: string = data.metadata?.map?.name ?? "";
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

  type Tab = "scoreboard" | "player" | "mvp" | "heatmap" | "sites";
  const [tab, setTab] = useState<Tab>("scoreboard");
  const selectPlayer = (puuid: string) => {
    setSel(puuid);
    setTab("player");
  };

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "scoreboard", label: "Scoreboard", show: true },
    { key: "player", label: "Player", show: true },
    { key: "mvp", label: "Team MVP", show: ourTeamRanking.length > 0 },
    { key: "heatmap", label: "Heatmap", show: !!analysis?.positions },
    { key: "sites", label: "Sites", show: !!analysis?.site_tendencies },
  ];

  return (
    <>
      <div className="subnav">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.key} className={`chip-btn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "scoreboard" && (
        <>
          <Section title={`${mapName || "Match"} — scoreboard`} note="Click a player for their game breakdown.">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Player</th><th>Team</th><th>Agent</th>
                  <th><InfoLabel k="kills">K</InfoLabel></th>
                  <th><InfoLabel k="deaths">D</InfoLabel></th>
                  <th><InfoLabel k="assists">A</InfoLabel></th>
                  <th><InfoLabel k="score">Score</InfoLabel></th>
                </tr>
              </thead>
              <tbody>
                {players.map((p: any) => (
                  <tr
                    key={p.puuid}
                    className={p.puuid === selectedPuuid ? "selected" : ""}
                    onClick={() => selectPlayer(p.puuid)}
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
      )}

      {tab === "player" && (
        selected ? (
          <Section title={`Player breakdown — ${selected.name} (this game)`}>
            <PlayerCard p={selected} agentInfo={agents.data?.[(selected.agent.name ?? "").toLowerCase()]} />
          </Section>
        ) : (
          <div className="notice">Click a player on the Scoreboard tab to see their breakdown.</div>
        )
      )}

      {tab === "mvp" && ourTeamRanking.length > 0 && (
        <Section title="Advanced Team MVP — this match" note="Impact rating computed from this game only, normalized across the lobby.">
          <MvpRanking
            ranking={ourTeamRanking}
            weights={analysis?.mvp?.weights}
            weightTotal={analysis?.mvp?.weight_total}
          />
        </Section>
      )}

      {tab === "heatmap" && analysis?.positions && (
        <Section title={`Heatmap — ${mapName || "map"}`} note="Your team's kills and deaths for this match, on the minimap. (Spike plant locations are on the Sites tab.)">
          <Heatmap
            positions={analysis.positions}
            mapName={mapName}
            cal={maps.data?.[mapName.toLowerCase()]}
            players={(analysis.players ?? [])
              .filter((p) => p.team === analysis.our_team_id)
              .map((p) => ({ puuid: p.puuid, name: p.name }))}
          />
        </Section>
      )}

      {tab === "sites" && analysis?.site_tendencies && (
        <>
          {analysis.positions && analysis.positions.plants.length > 0 && (
            <Section title={`Spike plant locations — ${mapName || "map"}`} note="Where your team planted this match, colored by site.">
              <PlantMap plants={analysis.positions.plants} mapName={mapName} cal={maps.data?.[mapName.toLowerCase()]} />
            </Section>
          )}
          <Section title="Spike sites — this match">
            <SiteTendencies st={analysis.site_tendencies} />
          </Section>
        </>
      )}
    </>
  );
}

type HeatPoint = { x: number; y: number; side: string | null; phase: string; puuid: string | null };

function Heatmap({
  positions,
  mapName,
  cal,
  players,
}: {
  positions: NonNullable<MatchAnalysis["positions"]>;
  mapName: string;
  cal?: MapCalibration;
  players: { puuid: string; name: string }[];
}) {
  const [mode, setMode] = useState<"density" | "dots">("density");
  const [sideFilter, setSideFilter] = useState<"all" | "attack" | "defense">("all");
  const [phaseFilter, setPhaseFilter] = useState<"all" | "preplant" | "postplant">("all");
  const [playerFilter, setPlayerFilter] = useState<string>("all");
  const [layers, setLayers] = useState({ deaths: true, kills: true });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const passes = (p: HeatPoint) =>
    (sideFilter === "all" || p.side === sideFilter) &&
    (phaseFilter === "all" || p.phase === phaseFilter) &&
    (playerFilter === "all" || p.puuid === playerFilter);
  const count = (arr: HeatPoint[]) => arr.filter(passes).length;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !cal) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, HEAT_SIZE, HEAT_SIZE);

    const sets: { pts: HeatPoint[]; color: string }[] = [];
    if (layers.deaths) sets.push({ pts: positions.deaths, color: LAYER_COLORS.deaths });
    if (layers.kills) sets.push({ pts: positions.kills, color: LAYER_COLORS.kills });

    const project = (p: { x: number; y: number }) => {
      const { nx, ny } = toMinimap(cal, p.x, p.y);
      return { px: nx * HEAT_SIZE, py: ny * HEAT_SIZE };
    };

    if (mode === "density") {
      ctx.globalCompositeOperation = "lighter";
      const r = HEAT_SIZE * 0.05;
      for (const s of sets)
        for (const p of s.pts) {
          if (!passes(p)) continue;
          const { px, py } = project(p);
          const g = ctx.createRadialGradient(px, py, 0, px, py, r);
          g.addColorStop(0, `rgba(${s.color},0.5)`);
          g.addColorStop(1, `rgba(${s.color},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      ctx.globalCompositeOperation = "source-over";
    } else {
      for (const s of sets)
        for (const p of s.pts) {
          if (!passes(p)) continue;
          const { px, py } = project(p);
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${s.color},0.8)`;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = "rgba(0,0,0,0.55)";
          ctx.stroke();
        }
    }
  }, [positions, cal, mode, sideFilter, phaseFilter, playerFilter, layers]);

  if (!cal || !cal.minimap) return <div className="subtle">No minimap available for {mapName}.</div>;

  const LayerToggle = ({ k, label }: { k: "deaths" | "kills"; label: string }) => (
    <label className={`hc-layer ${k} ${layers[k] ? "on" : ""}`}>
      <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} />
      {label} ({count(positions[k])})
    </label>
  );

  return (
    <div className="heatmap">
      <div className="heatmap-controls">
        <div className="hc-group">
          {(["density", "dots"] as const).map((m) => (
            <button key={m} className={`chip-btn ${mode === m ? "active" : ""}`} onClick={() => setMode(m)}>{m}</button>
          ))}
        </div>
        <div className="hc-group">
          {(["all", "attack", "defense"] as const).map((s) => (
            <button key={s} className={`chip-btn ${sideFilter === s ? "active" : ""}`} onClick={() => setSideFilter(s)}>{s}</button>
          ))}
        </div>
        <div className="hc-group">
          {([["all", "All phases"], ["preplant", "Pre-plant"], ["postplant", "Post-plant"]] as const).map(([p, label]) => (
            <button key={p} className={`chip-btn ${phaseFilter === p ? "active" : ""}`} onClick={() => setPhaseFilter(p)}>{label}</button>
          ))}
        </div>
        <div className="hc-group">
          <select className="hc-select" value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)}>
            <option value="all">All players</option>
            {players.map((pl) => (
              <option key={pl.puuid} value={pl.puuid}>{pl.name}</option>
            ))}
          </select>
        </div>
        <div className="hc-group">
          <LayerToggle k="deaths" label="Deaths" />
          <LayerToggle k="kills" label="Kills" />
        </div>
      </div>
      <div className="heatmap-canvas" style={{ width: HEAT_SIZE, height: HEAT_SIZE, backgroundImage: `url(${cal.minimap})` }}>
        <canvas ref={canvasRef} width={HEAT_SIZE} height={HEAT_SIZE} />
      </div>
    </div>
  );
}

const SITE_COLORS: Record<string, string> = {
  A: "74,168,255",
  B: "251,191,36",
  C: "192,132,252",
};

function PlantMap({
  plants,
  mapName,
  cal,
}: {
  plants: NonNullable<MatchAnalysis["positions"]>["plants"];
  mapName: string;
  cal?: MapCalibration;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !cal) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, HEAT_SIZE, HEAT_SIZE);
    for (const p of plants) {
      const { nx, ny } = toMinimap(cal, p.x, p.y);
      const color = SITE_COLORS[p.site ?? ""] ?? "255,255,255";
      ctx.beginPath();
      ctx.arc(nx * HEAT_SIZE, ny * HEAT_SIZE, 7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color},0.85)`;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.stroke();
    }
  }, [plants, cal]);

  if (!cal || !cal.minimap) return <div className="subtle">No minimap available for {mapName}.</div>;

  const counts: Record<string, number> = {};
  for (const p of plants) counts[p.site ?? "?"] = (counts[p.site ?? "?"] ?? 0) + 1;

  return (
    <div className="heatmap">
      <div className="heatmap-controls">
        <div className="hc-group">
          {Object.keys(counts).sort().map((site) => (
            <span key={site} className="plant-legend">
              <span className="plant-dot" style={{ background: `rgb(${SITE_COLORS[site] ?? "255,255,255"})` }} />
              Site {site} ({counts[site]})
            </span>
          ))}
        </div>
      </div>
      <div className="heatmap-canvas" style={{ width: HEAT_SIZE, height: HEAT_SIZE, backgroundImage: `url(${cal.minimap})` }}>
        <canvas ref={canvasRef} width={HEAT_SIZE} height={HEAT_SIZE} />
      </div>
    </div>
  );
}

function SiteTendencies({ st }: { st: NonNullable<MatchAnalysis["site_tendencies"]> }) {
  const attack = Object.entries(st.attack_sites);
  const retake = Object.entries(st.retake_sites);
  return (
    <div className="site-tend">
      <div className="subtle" style={{ marginBottom: 12 }}>
        {st.total_plants} attack plant{st.total_plants === 1 ? "" : "s"} ·{" "}
        <InfoLabel k="avg_plant_time">avg plant time</InfoLabel> {st.avg_plant_time_s ?? "—"}s
      </div>
      <div className="site-cols">
        <div>
          <h4>Attack plants by site</h4>
          {attack.length === 0 ? (
            <div className="subtle">No attack plants this match.</div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Site</th><th>Plants</th>
                <th><InfoLabel k="plant_site_dist">Share</InfoLabel></th>
                <th className="wr-col"><InfoLabel k="site_win_rate">Win rate</InfoLabel></th>
              </tr></thead>
              <tbody>
                {attack.map(([s, v]) => (
                  <tr key={s}>
                    <td className="name-cell">{s}</td><td>{v.plants}</td><td>{v.share}%</td>
                    <td className="wr-col"><WinRateBar pct={v.win_rate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h4>Defense retakes by enemy site</h4>
          {retake.length === 0 ? (
            <div className="subtle">No enemy plants on defense this match.</div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Site</th><th>Enemy plants</th>
                <th className="wr-col"><InfoLabel k="retake_by_site">Retake win rate</InfoLabel></th>
              </tr></thead>
              <tbody>
                {retake.map(([s, v]) => (
                  <tr key={s}>
                    <td className="name-cell">{s}</td><td>{v.opportunities}</td>
                    <td className="wr-col"><WinRateBar pct={v.win_rate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ p, agentInfo }: { p: MatchPlayerAnalysis; agentInfo?: AgentInfo }) {
  const stats: { info: string; label: string; value: string | number }[] = [
    { info: "acs", label: "ACS", value: p.acs },
    { info: "adr", label: "ADR", value: p.adr },
    { info: "hs_pct", label: "HS%", value: `${p.hs_pct}%` },
    { info: "kda", label: "K / D / A", value: `${p.kills} / ${p.deaths} / ${p.assists}` },
    { info: "kast", label: "KAST", value: `${p.kast}%` },
    { info: "first_kills", label: "First bloods", value: p.first_kills },
    { info: "multikills", label: "Multikills", value: p.multikill_rounds },
    { info: "clutches", label: "Clutches", value: p.clutches },
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
            <div className="stat-label"><InfoLabel k="impact_rating">Impact (this game)</InfoLabel></div>
          </div>
        )}
      </div>

      <div className="pc-stats">
        {stats.map((s) => (
          <div className="pc-stat" key={s.label}>
            <div className="pc-stat-val">{s.value}</div>
            <div className="pc-stat-label"><InfoLabel k={s.info}>{s.label}</InfoLabel></div>
          </div>
        ))}
      </div>

      <div className="pc-sections">
        <div className="pc-section">
          <h4><InfoLabel k="utility_usage">Utility usage / round</InfoLabel></h4>
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
          <h4><InfoLabel k="impact_rating">Impact breakdown (normalized 0–1)</InfoLabel></h4>
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
