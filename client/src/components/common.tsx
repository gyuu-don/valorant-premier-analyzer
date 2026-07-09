import type { ReactNode } from "react";
import { STAT_INFO } from "../statInfo";
import { useStatParams, fmtSeconds } from "../statParams";

// A stat name with a hover/focus tooltip explaining the stat and its calculation.
// Usage: <InfoLabel k="acs" /> (uses the canonical label) or <InfoLabel k="kd">K/D</InfoLabel>.
// Tooltip text may contain dynamic tokens (e.g. {TRADE_S}) filled from live settings.
export function InfoLabel({ k, children }: { k: string; children?: ReactNode }) {
  const info = STAT_INFO[k];
  const { tradeWindowMs } = useStatParams();
  const text = children ?? info?.label ?? k;
  if (!info) return <>{text}</>;
  const desc = info.desc.replace(/\{TRADE_S\}/g, fmtSeconds(tradeWindowMs));
  return (
    <span className="info-label" tabIndex={0}>
      {text}
      <span className="info-tip" role="tooltip">
        <span className="info-tip-title">{info.label}</span>
        <span className="info-tip-desc">{desc}</span>
      </span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "good" | "bad" | "neutral";
}) {
  return (
    <div className={`stat-card ${tone ?? "neutral"}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// Stage-over-stage change indicator for a percentage stat. Renders nothing unless both
// current and previous values are present. ±2pt threshold: green ▲ / yellow = / red ▼.
export function Delta({
  cur,
  prev,
  prevLabel,
}: {
  cur?: number | null;
  prev?: number | null;
  prevLabel?: string;
}) {
  if (cur == null || prev == null) return null;
  const d = Math.round((cur - prev) * 10) / 10;
  const dir = d >= 2 ? "up" : d <= -2 ? "down" : "equal";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "＝";
  const sign = d > 0 ? "+" : "";
  const title = `${sign}${d}% from previous stage${prevLabel ? ` (${prevLabel})` : ""}`;
  return (
    <span className={`delta ${dir}`} tabIndex={0} aria-label={title}>
      {arrow}
      <span className="delta-tip" role="tooltip">{title}</span>
    </span>
  );
}

// A win-rate bar with an optional delta indicator beside it (for table cells).
export function WinRateCell({ pct, delta }: { pct: number; delta?: ReactNode }) {
  return (
    <div className="wr-cell">
      <WinRateBar pct={pct} />
      {delta}
    </div>
  );
}

export function WinRateBar({ pct }: { pct: number }) {
  const tone = pct >= 55 ? "good" : pct <= 45 ? "bad" : "mid";
  return (
    <div className="wr">
      <div className="wr-bar">
        <div className={`wr-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <span className="wr-text">{pct}%</span>
    </div>
  );
}

export function Loading() {
  return <div className="notice">Loading report… May take a moment.</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="notice error">
      <strong>Could not load data.</strong>
      <p>{msg}</p>
      <p className="hint">
        Check that the backend is running, <code>HENRIK_API_KEY</code> is set, and the
        team name/tag/region in <code>.env</code> are correct.
      </p>
    </div>
  );
}

export function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {note && <p className="panel-note">{note}</p>}
      {children}
    </section>
  );
}
