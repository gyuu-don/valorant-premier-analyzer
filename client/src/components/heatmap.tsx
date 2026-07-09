import { useEffect, useRef, useState } from "react";
import { toMinimap, type MapCalibration } from "../maps";
import type { MatchAnalysis } from "../types";

export const HEAT_SIZE = 680;
const LAYER_COLORS: Record<string, string> = {
  deaths: "225,29,72",   // matches --bad (#e11d48)
  kills: "74,222,128",
};

type HeatPoint = { x: number; y: number; side: string | null; phase: string; puuid: string | null };

// Kill/death heatmap over a map's minimap, with density/dots + side/phase/player filters.
// Used by both the Match Analysis tab (single match) and Maps & Agents (cumulative per map).
export function Heatmap({
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
