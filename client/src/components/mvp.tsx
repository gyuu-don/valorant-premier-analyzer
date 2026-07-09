import { InfoLabel, Section, WinRateBar } from "./common";
import { playerCardImage } from "../media";
import type { MvpEntry, Report } from "../types";

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

// The full Advanced Team MVP widget: rating card, in-game-MVP award stats, ranking, explainer.
export function TeamMvpSection({ mvp }: { mvp: NonNullable<Report["mvp"]> }) {
  if (!mvp.mvp) return null;
  return (
    <Section title="Advanced Team MVP">
      <div className="mvp-row">
        <div className="mvp-card">
          {playerCardImage(mvp.mvp.card) && (
            <img className="player-card-lg mvp-card-img" src={playerCardImage(mvp.mvp.card)!} alt={mvp.mvp.name} />
          )}
          <div className="mvp-name">{mvp.mvp.name}</div>
          <div className="mvp-rating">{mvp.mvp.rating}</div>
          <div className="stat-label">Impact rating <br></br> (0–100)</div>
        </div>
        <div className="mvp-compare">
          {mvp.awards?.most_game_mvp && (
            <p>
              <InfoLabel k="most_game_mvp">Most in-game MVPs</InfoLabel>:{" "}
              <strong>{mvp.awards.most_game_mvp.name}</strong>{" "}
              <span className="subtle">
                {mvp.awards.most_game_mvp.pct}% of matches ({mvp.awards.most_game_mvp.count}/{mvp.awards.matches})
              </span>
            </p>
          )}
          {mvp.awards && (
            <p>
              <InfoLabel k="mvp_disagreement">Advanced vs in-game MVP differ</InfoLabel>:{" "}
              <strong>{mvp.awards.differed_pct}%</strong>{" "}
              <span className="subtle">({mvp.awards.differed}/{mvp.awards.matches} matches)</span>
            </p>
          )}
          <MvpRanking ranking={mvp.ranking} weights={mvp.weights} weightTotal={mvp.weight_total} />
        </div>
      </div>
      <MvpExplainer mvp={mvp} />
    </Section>
  );
}

// Explains how the impact rating is computed, with a worked example from the current MVP.
export function MvpExplainer({ mvp }: { mvp: NonNullable<Report["mvp"]> }) {
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
            <td>
              <span className="agent-inline">
                {playerCardImage(r.card)
                  ? <img className="agent-face-sm" src={playerCardImage(r.card)!} alt="" loading="lazy" />
                  : <span className="agent-face-sm agent-face-ph">{r.name[0]}</span>}
                {r.name}
              </span>
            </td>
            <td><ImpactCell entry={r} weights={weights} weightTotal={weightTotal} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
