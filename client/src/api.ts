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

export const fetchReport = (limit?: number) =>
  getJson<Report>(`/api/analytics/report${limit ? `?limit=${limit}` : ""}`);

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

export const fetchMatches = (offset = 0, limit = 10) =>
  getJson<MatchPage>(`/api/matches?offset=${offset}&limit=${limit}`);

export const fetchMatch = (matchId: string) =>
  getJson<any>(`/api/match/${matchId}`);

export const fetchHealth = () =>
  getJson<{ status: string; team_configured: boolean; api_key_present: boolean }>(
    "/api/health"
  );
