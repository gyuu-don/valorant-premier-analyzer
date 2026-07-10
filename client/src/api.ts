import type { Report } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

const seasonParam = (season?: string | null) =>
  season && season !== "all" ? `season=${encodeURIComponent(season)}` : "";

export const fetchReport = (season?: string | null) => {
  const qs = seasonParam(season);
  return getJson<Report>(`/api/analytics/report${qs ? `?${qs}` : ""}`);
};

export interface Stage {
  id: string;
  short: string | null;
  starts_at: string;
  ends_at: string;
  matches: number;
}

export const fetchStages = () => getJson<{ stages: Stage[] }>("/api/stages");

export const fetchMapDetail = (season?: string | null) => {
  const qs = seasonParam(season);
  return getJson<import("./types").MapDetail>(`/api/analytics/map-detail${qs ? `?${qs}` : ""}`);
};

export const fetchTeam = () => getJson<any>("/api/team");

export const fetchTeamHistory = () =>
  getJson<{ team_id: string; history: any[] }>("/api/team/history");

export interface MatchSummary {
  match_id: string;
  started_at?: string | null;
  map: string;
  opponent: string;
  result: "W" | "L";
  score: string;
}

export interface MatchPage {
  matches: MatchSummary[];
  offset: number;
  next_offset: number;
  has_more: boolean;
  total: number;
}

export const fetchMatches = (offset = 0, limit = 10, season?: string | null) => {
  const qs = seasonParam(season);
  return getJson<MatchPage>(`/api/matches?offset=${offset}&limit=${limit}${qs ? `&${qs}` : ""}`);
};

export const fetchMatch = (matchId: string) =>
  getJson<any>(`/api/match/${matchId}`);

export const fetchHealth = () =>
  getJson<{ status: string; team_configured: boolean; api_key_present: boolean }>(
    "/api/health"
  );

export interface PlanningPlayer {
  id: string;
  name: string;
}

export interface PlanningMatch {
  id: string;
  poll_id?: string;
  option?: string;
  choice?: string;
  map: string;
  starts_at?: string | null;
  poll_url: string;
  available_players: PlanningPlayer[];
  igl?: PlanningPlayer | null;
}

export interface PlanningPage {
  matches: PlanningMatch[];
  configured: boolean;
  missing: string[];
  source: "discord_poll";
}

export const fetchPlanning = () => getJson<PlanningPage>("/api/planning");
