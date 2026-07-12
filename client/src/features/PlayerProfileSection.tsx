import { useQuery } from "@tanstack/react-query";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { fetchAgentIcons } from "../agents";
import { Section } from "../components/common";
import { playerCardImage } from "../media";
import type { PlayerRow, PlayerUsageStat } from "../types";

// Rough per-metric maxima used to scale the radar to 0..100.
const RADAR_MAX: Record<string, number> = {
  ACS: 300,
  "K/D": 2,
  ADR: 200,
  "KAST%": 100,
  "HS%": 40,
};

export default function PlayerProfileSection({
  player,
}: {
  player: PlayerRow;
}) {
  const iconData = useQuery({
    queryKey: ["agent-icons"],
    queryFn: fetchAgentIcons,
    staleTime: Infinity,
  });
  const roleIcons = iconData.data?.roleIcons;
  const radarData = [
    { metric: "ACS", v: scale(player.acs, RADAR_MAX["ACS"]) },
    { metric: "K/D", v: scale(player.kd, RADAR_MAX["K/D"]) },
    { metric: "ADR", v: scale(player.adr, RADAR_MAX["ADR"]) },
    { metric: "KAST%", v: player.kast },
    { metric: "HS%", v: scale(player.hs_pct, RADAR_MAX["HS%"]) },
  ];

  const preferredRoles = getPreferredRoles(player.roles ?? []);
  const preferredRoleNames = preferredRoles.map((role) => role.name).join(", ");
  const preferredRoleLabel = preferredRoles.length > 1 ? "Preferred roles" : "Preferred role";
  const roleUsageTotal = (player.roles ?? []).reduce((sum, item) => sum + item.games, 0) || 1;
  const preferredRolePickRate = preferredRoles.length > 0
    ? Math.round((100 * preferredRoles[0].games) / roleUsageTotal)
    : null;

  const bestRoles = getBestRoles(player.roles ?? []);
  const bestRoleNames = bestRoles.map((role) => role.name).join(", ");
  const bestRoleLabel = bestRoles.length > 1 ? "Best roles" : "Best role";
  const bestRoleWinRate =
    bestRoles.length > 0 && typeof bestRoles[0].win_rate === "number"
      ? bestRoles[0].win_rate
      : null;
  const bestRoleGames = bestRoles.length > 0 ? bestRoles[0].games : null;

  return (
    <>
      <Section title={`Profile — ${player.name}`}>
        <div className="profile-head">
          <div className="profile-head-main">
            {playerCardImage(player.card) ? (
              <img
                className="player-card-lg"
                src={playerCardImage(player.card)!}
                alt={player.name}
              />
            ) : (
              <span className="player-card-lg player-card-ph">
                {player.name[0]}
              </span>
            )}
            <div>
              <div className="pc-name">{player.name}</div>
              {bestRoles.length > 0 ? (
                <div className="subtle">
                  {bestRoleLabel}: <strong>{bestRoleNames}</strong>
                  {bestRoleWinRate !== null ? ` · ${bestRoleWinRate}% win rate` : ""}
                  {bestRoleGames !== null ? ` (${bestRoleGames})` : ""}
                </div>
              ) : null}
            </div>
          </div>
          {roleIcons && preferredRoles.length > 0 ? (
            <div className="profile-role-block">
              <div className="profile-role-icons">
                {preferredRoles.map((role) => {
                  const icon = roleIcons[role.name.toLowerCase()];
                  return icon ? (
                    <img
                      key={role.name}
                      src={icon}
                      alt={role.name}
                      loading="lazy"
                      style={{ width: 28, height: 28, borderRadius: 6 }}
                    />
                  ) : null;
                })}
              </div>
              <div className="profile-role-meta">
                <div className="profile-role-label subtle">{preferredRoleLabel}</div>
                <div className="profile-role-text">
                  <strong>{preferredRoleNames}</strong>
                  <span className="subtle">· {preferredRolePickRate}% pick rate</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="profile">
          <div className="radar-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#333" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: "#aab", fontSize: 12 }}
                />
                <Radar
                  dataKey="v"
                  stroke="#ff4655"
                  fill="#ff4655"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="profile-stats">
            <div>
              <span>Kills / Deaths / Assists</span>
              <strong>
                {player.kills} / {player.deaths} / {player.assists}
              </strong>
            </div>
            <div>
              <span>Rounds played</span>
              <strong>{player.rounds_played}</strong>
            </div>
            <div>
              <span>Multikill rounds</span>
              <strong>{player.multikill_rounds}</strong>
            </div>
            <div>
              <span>Clutches</span>
              <strong>{player.clutches}</strong>
            </div>
            <div>
              <span>Preferred role</span>
              <strong>{preferredRoleNames || "—"}</strong>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Role win rate">
        <UsageList
          items={player.roles ?? []}
          icons={roleIcons}
          iconSizeMultiplier={0.75}
        />
      </Section>

      <Section title="Agents win rate">
        <UsageList
          items={player.agents ?? []}
          icons={iconData.data?.agentIcons}
        />
      </Section>
    </>
  );
}

function UsageList({
  items,
  icons,
  iconSizeMultiplier = 1,
}: {
  items: PlayerUsageStat[];
  icons?: Record<string, string>;
  iconSizeMultiplier?: number;
}) {
  if (!items || items.length === 0)
    return <div className="subtle">No data.</div>;
  const total = items.reduce((s, item) => s + item.games, 0) || 1;
  const iconSize = 56 * iconSizeMultiplier;
  const iconRadius = 10 * iconSizeMultiplier;
  return (
    <div className="agent-usage">
      {items.map((item) => {
        const pickRate = Math.round((100 * item.games) / total);
        const icon = icons?.[item.name.toLowerCase()];
        const winRate =
          typeof item.win_rate === "number" ? item.win_rate : null;
        return (
          <div className="agent-row" key={item.name}>
            <div className="agent-face">
              {icon ? (
                <img
                  style={{
                    width: iconSize,
                    height: iconSize,
                    borderRadius: iconRadius,
                  }}
                  src={icon}
                  alt={item.name}
                  loading="lazy"
                />
              ) : (
                <span className="agent-face-ph">{item.name[0]}</span>
              )}
            </div>
            <div className="agent-meta">
              <div className="agent-name">
                {item.name}{" "}
                <span className="subtle">
                  · {item.games} {item.games === 1 ? "game" : "games"}
                  {` · pick rate ${pickRate}%`}
                </span>
              </div>
              <div className="pick">
                <div className="pick-bar">
                  <div className="pick-fill" style={{ width: `${winRate}%` }} />
                </div>
                <span className="pick-pct">{winRate}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getPreferredRoles(items: PlayerUsageStat[]) {
  if (!items || items.length === 0) return [];
  const maxGames = items.reduce(
    (max, item) => (item.games > max ? item.games : max),
    items[0].games
  );
  return items.filter((item) => item.games === maxGames);
}

function getBestRoles(items: PlayerUsageStat[]) {
  const valid = items.filter(
    (item): item is PlayerUsageStat & { win_rate: number } =>
      typeof item.win_rate === "number"
  );
  if (valid.length === 0) return [];

  const maxWinRate = valid.reduce(
    (max, item) => (item.win_rate > max ? item.win_rate : max),
    valid[0].win_rate
  );

  const topWinRateRoles = valid.filter((item) => item.win_rate === maxWinRate);
  if (topWinRateRoles.length <= 1) return topWinRateRoles;

  const maxGames = topWinRateRoles.reduce(
    (max, item) => (item.games > max ? item.games : max),
    topWinRateRoles[0].games
  );

  return topWinRateRoles.filter((item) => item.games === maxGames);
}

function scale(v: number, max: number) {
  return Math.round(Math.min(100, (100 * v) / max));
}
