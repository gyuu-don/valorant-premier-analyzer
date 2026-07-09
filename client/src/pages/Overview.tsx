import { useReport } from "../hooks";
import { ErrorBox, InfoLabel, Loading, Section, StatCard, WinRateBar } from "../components/common";
import type { ReactNode } from "react";

export default function Overview() {
  const { data, isLoading, error } = useReport();
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  if (data.matches_analyzed === 0) {
    return (
      <div className="notice error">
        <strong>No analyzable matches found.</strong>
        <p>{data.warning}</p>
      </div>
    );
  }

  const { team, record, recent_form, sides } = data;
  const wr = record ? Math.round((100 * record.wins) / Math.max(1, record.wins + record.losses)) : 0;

  return (
    <div className="page overview">
      <div className="page-head">
        <h1>
          {team.name} <span className="tag">#{team.tag}</span>
        </h1>
        <div className="subtle">
          {team.region?.toUpperCase()} · {team.conference ?? "—"} · Division {team.division ?? "—"}
          {team.place != null && ` · #${team.place} (${team.points ?? 0} pts)`}
          {team.wins != null && ` · Premier standing ${team.wins}–${team.losses}`}
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          label={<InfoLabel k="record">{`Record (${data.matches_analyzed} analyzed)`}</InfoLabel>}
          value={`${record?.wins}–${record?.losses}`}
          sub={`${wr}% win rate`}
          tone={wr >= 50 ? "good" : "bad"}
        />
        <StatCard label={<InfoLabel k="attack_win_rate">Attack RWR</InfoLabel>} value={`${sides?.attack_win_rate ?? 0}%`}
          sub={`${sides?.attack_rounds ?? 0} rounds`}
          tone={(sides?.attack_win_rate ?? 0) >= 50 ? "good" : "bad"} />
        <StatCard label={<InfoLabel k="defense_win_rate">Defense RWR</InfoLabel>} value={`${sides?.defense_win_rate ?? 0}%`}
          sub={`${sides?.defense_rounds ?? 0} rounds`}
          tone={(sides?.defense_win_rate ?? 0) >= 50 ? "good" : "bad"} />
        <StatCard
          label={<InfoLabel k="recent_form">Recent form</InfoLabel>}
          value={<RecentForm form={(recent_form ?? []).slice(-10)} />}
          sub={
            (recent_form?.length ?? 0) > 0 ? (
              <span className="form-axis"><span>oldest</span><span className="arrow">→</span><span>latest</span></span>
            ) : undefined
          }
        />
      </div>

      <Section title="Side & economy win rates">
        <div className="bars">
          <LabeledBar label={<InfoLabel k="attack_win_rate">Attack</InfoLabel>} pct={sides?.attack_win_rate ?? 0} />
          <LabeledBar label={<InfoLabel k="defense_win_rate">Defense</InfoLabel>} pct={sides?.defense_win_rate ?? 0} />
          {sides &&
            Object.entries(sides.economy).map(([bucket, v]) => (
              <LabeledBar key={bucket} label={<InfoLabel k={bucket}>{bucket.replace("_", " ")}</InfoLabel>} pct={v.win_rate} extra={`${v.rounds} rds`} />
            ))}
        </div>
      </Section>
    </div>
  );
}

function LabeledBar({ label, pct, extra }: { label: ReactNode; pct: number; extra?: string }) {
  return (
    <div className="labeled-bar">
      <div className="lb-label">
        <span className="cap">{label}</span>
        {extra && <span className="subtle">{extra}</span>}
      </div>
      <WinRateBar pct={pct} />
    </div>
  );
}


function RecentForm({ form }: { form: { result: string; started_at?: string | null }[] }) {
  if (form.length === 0) return <span className="subtle">—</span>;
  const fmt = (d?: string | null) => {
    if (!d) return "date unknown";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const n = form.length;
  return (
    <span className="form">
      {form.map((f, i) => {
        const isLatest = i === n - 1;
        // Older results fade; the most recent is full strength and ringed.
        const opacity = n === 1 ? 1 : 0.4 + 0.6 * (i / (n - 1));
        return (
          <span
            key={i}
            className={`${f.result === "W" ? "w" : "l"}${isLatest ? " latest" : ""}`}
            style={{ opacity }}
            title={`${f.result === "W" ? "Win" : "Loss"} · ${fmt(f.started_at)}${isLatest ? " · most recent" : ""}`}
          >
            {f.result}
          </span>
        );
      })}
    </span>
  );
}
