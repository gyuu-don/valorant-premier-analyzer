import { useReport } from "../hooks";
import { ErrorBox, Loading, Section, StatCard, WinRateBar } from "../components/common";
import type { Report } from "../types";
import { COMPONENT_LABELS, MvpRanking } from "../components/mvp";

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

  const { team, record, recent_form, sides, mvp } = data;
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
          label={`Record (${data.matches_analyzed} analyzed)`}
          value={`${record?.wins}–${record?.losses}`}
          sub={`${wr}% win rate`}
          tone={wr >= 50 ? "good" : "bad"}
        />
        <StatCard label="Attack RWR" value={`${sides?.attack_win_rate ?? 0}%`}
          sub={`${sides?.attack_rounds ?? 0} rounds`}
          tone={(sides?.attack_win_rate ?? 0) >= 50 ? "good" : "bad"} />
        <StatCard label="Defense RWR" value={`${sides?.defense_win_rate ?? 0}%`}
          sub={`${sides?.defense_rounds ?? 0} rounds`}
          tone={(sides?.defense_win_rate ?? 0) >= 50 ? "good" : "bad"} />
        <StatCard
          label="Recent form"
          value={<RecentForm form={(recent_form ?? []).slice(-10)} />}
          sub={
            (recent_form?.length ?? 0) > 0 ? (
              <span className="form-axis"><span>oldest</span><span className="arrow">→</span><span>latest</span></span>
            ) : undefined
          }
        />
      </div>

      {mvp?.mvp && (
        <Section title="Advanced Team MVP">
          <div className="mvp-row">
            <div className="mvp-card">
              <div className="mvp-name">{mvp.mvp.name}</div>
              <div className="mvp-rating">{mvp.mvp.rating}</div>
              <div className="stat-label">Impact rating (0–100)</div>
            </div>
            <div className="mvp-compare">
              <p>
                Riot in-game (raw score) MVP:{" "}
                <strong>{mvp.official_mvp?.name}</strong>{" "}
                <span className="subtle">({mvp.official_mvp?.score} pts)</span>
              </p>
              <MvpRanking ranking={mvp.ranking} weights={mvp.weights} weightTotal={mvp.weight_total} />
            </div>
          </div>
          <MvpExplainer mvp={mvp} />
        </Section>
      )}

      <Section title="Side & economy win rates">
        <div className="bars">
          <LabeledBar label="Attack" pct={sides?.attack_win_rate ?? 0} />
          <LabeledBar label="Defense" pct={sides?.defense_win_rate ?? 0} />
          {sides &&
            Object.entries(sides.economy).map(([bucket, v]) => (
              <LabeledBar key={bucket} label={bucket.replace("_", " ")} pct={v.win_rate} extra={`${v.rounds} rds`} />
            ))}
        </div>
      </Section>
    </div>
  );
}

function LabeledBar({ label, pct, extra }: { label: string; pct: number; extra?: string }) {
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

function MvpExplainer({ mvp }: { mvp: NonNullable<Report["mvp"]> }) {
  const weights = mvp.weights ?? {};
  const total = mvp.weight_total ?? (Object.values(weights).reduce((a, b) => a + b, 0) || 1);
  const example = mvp.mvp;
  const rows = Object.keys(weights).map((k) => {
    const weight = weights[k];
    const norm = example?.components[k] ?? 0;
    return { k, label: COMPONENT_LABELS[k] ?? k, weight, norm, contrib: weight * norm };
  });
  const sum = rows.reduce((a, r) => a + r.contrib, 0);
  const pctWeight = (w: number) => Math.round((100 * w) / total);
  const acsW = weights["acs"] ?? 0;
  const acsN = example?.components["acs"] ?? 0;

  return (
    <details className="mvp-explainer" open>
      <summary>How is the impact rating calculated?</summary>
      <div className="explainer-body">
        <p>
          The impact rating is a single <strong>0–100</strong> score that blends seven
          per-round performance metrics into one number, so you can compare overall impact
          rather than juggling seven stat columns. Raw combat score (ACS) alone rewards
          fraggers; this also credits the KAST consistency, entry duels, trades, multikills
          and clutches that win rounds.
        </p>
        <p>
          Each metric is <strong>min-max normalized</strong> across your roster — the
          team-best in that metric scores <strong>1.0</strong>, the team-worst
          <strong> 0.0</strong>, and everyone else lands proportionally in between. Those
          normalized values are multiplied by each metric's weight, summed, and scaled to 100:
        </p>
        <p className="formula">rating = 100 × Σ(weight × normalized) ÷ Σweight</p>

        <div className="explainer-cols">
          <div>
            <h4>Component weights</h4>
            <ul className="weight-list">
              {rows.map((r) => (
                <li key={r.k}><span>{r.label}</span><span>{pctWeight(r.weight)}%</span></li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Worked example — {example?.name}</h4>
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
            <p className="formula">100 × {sum.toFixed(3)} ÷ {total.toFixed(2)} = <strong>{example?.rating}</strong></p>
            <p className="explainer-note">
              Reading one line: ACS carries {pctWeight(acsW)}% weight, and {example?.name}'s
              ACS normalized to {acsN.toFixed(2)} versus the roster — so it adds
              {" "}{(acsW * acsN).toFixed(3)} to the score. A player with the team's best ACS
              would normalize to 1.00 and contribute the full {acsW.toFixed(2)}.
            </p>
          </div>
        </div>
      </div>
    </details>
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
