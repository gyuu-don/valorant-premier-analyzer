import { useReport, usePreviousReport } from "../hooks";
import { ErrorBox, InfoLabel, Loading, Section, StatCard, WinRateBar, Delta } from "../components/common";
import type { ReactNode } from "react";

export default function Overview() {
  const { data, isLoading, error } = useReport();
  const prev = usePreviousReport();
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

  const { team, record, recent_form, sides, situational } = data;
  const wr = record ? Math.round((100 * record.wins) / Math.max(1, record.wins + record.losses)) : 0;

  const prevData = prev.data;
  const prevShort = prev.stage?.short?.toUpperCase();
  const prevRec = prevData?.record;
  const prevWr = prevRec ? Math.round((100 * prevRec.wins) / Math.max(1, prevRec.wins + prevRec.losses)) : undefined;
  const pd = (cur?: number, prevVal?: number) => <Delta cur={cur} prev={prevVal} prevLabel={prevShort} />;

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
          sub={<>{wr}% win rate {pd(wr, prevWr)}</>}
          tone={wr >= 50 ? "good" : "bad"}
        />
        <StatCard label={<InfoLabel k="attack_win_rate">Attack RWR</InfoLabel>}
          value={<>{sides?.attack_win_rate ?? 0}% {pd(sides?.attack_win_rate, prevData?.sides?.attack_win_rate)}</>}
          sub={`${sides?.attack_rounds ?? 0} rounds`}
          tone={(sides?.attack_win_rate ?? 0) >= 50 ? "good" : "bad"} />
        <StatCard label={<InfoLabel k="defense_win_rate">Defense RWR</InfoLabel>}
          value={<>{sides?.defense_win_rate ?? 0}% {pd(sides?.defense_win_rate, prevData?.sides?.defense_win_rate)}</>}
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
          <LabeledBar label={<InfoLabel k="attack_win_rate">Attack</InfoLabel>} pct={sides?.attack_win_rate ?? 0}
            delta={pd(sides?.attack_win_rate, prevData?.sides?.attack_win_rate)} />
          <LabeledBar label={<InfoLabel k="defense_win_rate">Defense</InfoLabel>} pct={sides?.defense_win_rate ?? 0}
            delta={pd(sides?.defense_win_rate, prevData?.sides?.defense_win_rate)} />
          {sides &&
            Object.entries(sides.economy).map(([bucket, v]) => (
              <LabeledBar key={bucket} label={<InfoLabel k={bucket}>{bucket.replace("_", " ")}</InfoLabel>} pct={v.win_rate} extra={`${v.rounds} rds`}
                delta={pd(v.win_rate, prevData?.sides?.economy?.[bucket]?.win_rate)} />
            ))}
        </div>
      </Section>

      {situational && (
        <Section title="Situational & timing">
          <div className="stat-grid">
            {(
              [
                ["first_blood_rate", 50],
                ["first_blood_conversion", 55],
                ["fb_conceded_recovery", 45],
                ["pistol_win_rate", 55],
                ["rwr_1v1", 50],
                ["rwr_2v2", 50],
                ["clutch_1vx", 30],
                ["enemy_clutch_denied", 60],
              ] as const
            ).map(([key, good]) => (
              <SitCard
                key={key}
                k={key}
                s={situational[key]}
                good={good}
                prevRate={prevData?.situational?.[key].rate}
                prevLabel={prevShort}
              />
            ))}
            <StatCard
              label={<InfoLabel k="median_plant_time">Median plant time</InfoLabel>}
              value={situational.median_plant_time_s != null ? `${situational.median_plant_time_s}s` : "—"}
              sub={
                situational.median_plant_time_s != null
                  ? `${clockRemaining(situational.median_plant_time_s)} left on clock · ${situational.plant_time_rounds} rounds`
                  : `${situational.plant_time_rounds} planted rounds`
              }
            />
          </div>
        </Section>
      )}
    </div>
  );
}

// Valorant play phase is 1:40 (100s) from the barrier drop; plant timestamps are measured
// from that point, so time remaining on the round clock = 100s − elapsed.
const ROUND_PLAY_SECONDS = 100;
function clockRemaining(elapsedSec: number): string {
  const rem = Math.max(0, ROUND_PLAY_SECONDS - elapsedSec);
  const m = Math.floor(rem / 60);
  const s = Math.floor(rem % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SitCard({
  k,
  s,
  good,
  prevRate,
  prevLabel,
}: {
  k: string;
  s: { rate: number; won: number; total: number };
  good: number;
  prevRate?: number;
  prevLabel?: string;
}) {
  const tone = s.total === 0 ? "neutral" : s.rate >= good ? "good" : "bad";
  return (
    <StatCard
      label={<InfoLabel k={k} />}
      value={<>{s.rate}% <Delta cur={s.rate} prev={prevRate} prevLabel={prevLabel} /></>}
      sub={`${s.won}/${s.total} rounds`}
      tone={tone}
    />
  );
}

function LabeledBar({
  label,
  pct,
  extra,
  delta,
}: {
  label: ReactNode;
  pct: number;
  extra?: string;
  delta?: ReactNode;
}) {
  return (
    <div className="labeled-bar">
      <span className="cap">{label} {delta}</span>
      <WinRateBar pct={pct} />
      <span className="lb-extra subtle">{extra}</span>
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
