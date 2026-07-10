import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlanning,
  setPlanningIgl,
  shufflePlanningIgl,
  type PlanningMatch,
} from "../api";
import { Loading } from "../components/common";
import { mapImage } from "../maps";

export default function Planning() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["planning"],
    queryFn: fetchPlanning,
  });

  if (isLoading) return <Loading />;
  if (error) return <PlanningError error={error} />;
  if (!data) return null;

  return (
    <div className="page planning">
      <div className="page-head planning-head">
        <div>
          <h1>Match Planning</h1>
          <div className="subtle">Discord poll choices - Manual IGL selection per slot</div>
        </div>
        <button className="chip-btn" type="button" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {!data.configured && (
        <div className="notice error">
          <strong>Discord availability is not connected yet.</strong>
          <p>Add {formatMissing(data.missing)} to the server environment.</p>
          <p className="hint">
            Enable Message Content Intent for the bot if polls are not appearing.
          </p>
        </div>
      )}

      {data.configured && data.matches.length === 0 && (
        <div className="notice">
          No Discord polls found. Increase <code>DISCORD_POLL_SCAN_LIMIT</code> if the
          latest polls are farther back in the channel.
        </div>
      )}

      <div className="poll-groups">
        {groupByPoll(data.matches).map((poll) => (
          <section className="poll-group" key={poll.id}>
            <div className="poll-group-head">
              <div>
                <h2>{poll.question}</h2>
                <div className="subtle">{poll.createdAt ? formatDate(poll.createdAt) : "Poll date unknown"}</div>
              </div>
              <a className="poll-link poll-group-link" href={poll.url} target="_blank" rel="noreferrer">
                Poll
              </a>
            </div>
            <div className="planning-grid">
              {poll.matches.map((match) => (
                <PlanningCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PlanningError({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="notice error">
      <strong>Could not load Discord planning data.</strong>
      <p>{msg}</p>
      <p className="hint">
        Check that the bot is installed in the server and can view the poll channel with{" "}
        <code>View Channel</code> and <code>Read Message History</code>.
      </p>
    </div>
  );
}

function PlanningCard({ match }: { match: PlanningMatch }) {
  const queryClient = useQueryClient();
  const [isIglMenuOpen, setIsIglMenuOpen] = useState(false);
  const image = mapImage(match.map);
  const iglId = match.igl?.id;
  const slot = match.choice || formatDate(match.starts_at);
  const option = match.option || "?";
  const canShuffle = match.available_players.length >= 5;

  const selectIgl = useMutation({
    mutationFn: (playerId: string) => setPlanningIgl(match.id, playerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planning"] }),
  });

  const shuffleIgl = useMutation({
    mutationFn: () => shufflePlanningIgl(match.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planning"] }),
  });

  const actionError = selectIgl.error ?? shuffleIgl.error;
  const isUpdating = selectIgl.isPending || shuffleIgl.isPending;

  return (
    <article className="planning-card">
      <div
        className="planning-map"
        style={image ? { backgroundImage: `linear-gradient(90deg, rgba(15,17,21,.88), rgba(15,17,21,.34)), url(${image})` } : undefined}
      >
        <div>
          <div className="planning-kicker">Option {option} - {slot}</div>
          <h2>{match.map}</h2>
        </div>
      </div>

      <div className="planning-body">
        <div className="planning-row">
          <span className="stat-label">Available</span>
          <strong>{match.available_players.length}</strong>
        </div>
        <div className="igl-banner">
          <div>
            <span className="stat-label">IGL</span>
            <strong>{match.igl?.name ?? "Not selected"}</strong>
          </div>
          <button
            className="chip-btn"
            type="button"
            onClick={() => shuffleIgl.mutate()}
            disabled={!canShuffle || isUpdating}
            title={canShuffle ? "Shuffle IGL" : "Shuffle requires at least 5 available players"}
          >
            {shuffleIgl.isPending ? "Shuffling..." : "Shuffle IGL"}
          </button>
        </div>
        <div className="igl-picker">
          <span className="stat-label">Manual IGL</span>
          <div className="igl-menu">
            <button
              className="igl-menu-trigger"
              type="button"
              onClick={() => setIsIglMenuOpen((open) => !open)}
              disabled={match.available_players.length === 0 || isUpdating}
              aria-haspopup="listbox"
              aria-expanded={isIglMenuOpen}
            >
              {match.igl?.name ?? "Select IGL"}
            </button>
            {isIglMenuOpen && (
              <div className="igl-menu-list" role="listbox" aria-label={`IGL for option ${option}`}>
                {match.available_players.map((player) => (
                  <button
                    key={player.id}
                    className={player.id === iglId ? "igl-menu-option selected" : "igl-menu-option"}
                    type="button"
                    role="option"
                    aria-selected={player.id === iglId}
                    onClick={() => {
                      setIsIglMenuOpen(false);
                      selectIgl.mutate(player.id);
                    }}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {actionError && (
          <div className="notice compact error">
            {actionError instanceof Error ? actionError.message : String(actionError)}
          </div>
        )}
        {match.available_players.length > 0 ? (
          <div className="player-chip-list" aria-label={`Players who selected option ${option}`}>
            {match.available_players.map((player) => (
              <span key={player.id} className={player.id === iglId ? "player-chip igl" : "player-chip"}>
                {player.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="notice compact">No players have selected option {option} yet.</div>
        )}
      </div>
    </article>
  );
}

function groupByPoll(matches: PlanningMatch[]) {
  const groups = new Map<
    string,
    { id: string; question: string; createdAt?: string | null; url: string; matches: PlanningMatch[] }
  >();
  for (const match of matches) {
    const id = match.poll_id || match.id;
    const group = groups.get(id);
    if (group) {
      group.matches.push(match);
      continue;
    }
    groups.set(id, {
      id,
      question: match.poll_question || "Discord poll",
      createdAt: match.poll_created_at,
      url: match.poll_url,
      matches: [match],
    });
  }
  return Array.from(groups.values());
}

function formatDate(value?: string | null): string {
  if (!value) return "Time TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time TBD";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMissing(values: string[]) {
  return values.map((value, index) => (
    <span key={value}>
      {index > 0 ? ", " : ""}
      <code>{value}</code>
    </span>
  ));
}
