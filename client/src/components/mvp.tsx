import { WinRateBar } from "./common";
import type { MvpEntry } from "../types";

export const COMPONENT_LABELS: Record<string, string> = {
  acs: "ACS",
  kast: "KAST",
  entry_win_rate: "Entry win %",
  trade_contribution: "Trade contribution",
  multikills: "Multikills",
  clutches: "Clutches",
  adr: "ADR",
};

// A single impact-rating bar with a hover tooltip showing the exact calculation.
export function ImpactCell({
  entry,
  weights,
  weightTotal,
}: {
  entry: MvpEntry;
  weights?: Record<string, number>;
  weightTotal?: number;
}) {
  const w = weights ?? {};
  const total = weightTotal ?? (Object.values(w).reduce((a, b) => a + b, 0) || 1);
  const rows = Object.keys(w).map((k) => {
    const weight = w[k];
    const norm = entry.components[k] ?? 0;
    return { k, label: COMPONENT_LABELS[k] ?? k, weight, norm, contrib: weight * norm };
  });
  const sum = rows.reduce((a, r) => a + r.contrib, 0);

  return (
    <div className="impact-cell" tabIndex={0}>
      <WinRateBar pct={entry.rating} />
      <div className="impact-tip" role="tooltip">
        <div className="tip-head">{entry.name} — impact {entry.rating}</div>
        <table className="tip-table">
          <thead>
            <tr><th>Component</th><th>weight</th><th>× norm</th><th>= contrib</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <td>{r.label}</td>
                <td>{r.weight.toFixed(2)}</td>
                <td>{r.norm.toFixed(3)}</td>
                <td>{r.contrib.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="tip-total">
          100 × {sum.toFixed(3)} ÷ {total.toFixed(2)} = <strong>{entry.rating}</strong>
        </div>
        <div className="tip-note">Each component is min-max normalized (0–1) across the roster.</div>
      </div>
    </div>
  );
}

// The ranked Player | Impact table, reused by Overview and Match Analysis.
export function MvpRanking({
  ranking,
  weights,
  weightTotal,
}: {
  ranking: MvpEntry[];
  weights?: Record<string, number>;
  weightTotal?: number;
}) {
  return (
    <table className="mini-table">
      <colgroup>
        <col className="mvp-col-name" />
        <col className="mvp-col-impact" />
      </colgroup>
      <thead>
        <tr><th>Player</th><th>Impact</th></tr>
      </thead>
      <tbody>
        {ranking.map((r) => (
          <tr key={r.puuid}>
            <td>{r.name}</td>
            <td><ImpactCell entry={r} weights={weights} weightTotal={weightTotal} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
