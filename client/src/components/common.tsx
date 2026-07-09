import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
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
  return <div className="notice">Loading report…</div>;
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
