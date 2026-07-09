// Loose types mirroring the backend report shape (server/app/analytics/report.py).

export interface PlayerRow {
  puuid: string;
  name: string;
  rounds_played: number;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  kd: number;
  kast: number;
  hs_pct: number;
  multikill_rounds: number;
  clutches: number;
  agents: { name: string; games: number }[];
}

export interface MvpEntry {
  puuid: string;
  name: string;
  rating: number;
  components: Record<string, number>;
}

export interface Callout {
  severity: "high" | "medium" | "low" | "info";
  area: string;
  text: string;
  gap?: number;
}

export interface MatchPlayerAnalysis {
  puuid: string;
  name: string;
  team: string;
  agent: { id?: string | null; name?: string | null };
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  kd: number;
  kast: number;
  hs_pct: number;
  rounds_played: number;
  multikill_rounds: number;
  clutches: number;
  first_kills: number;
  first_deaths: number;
  entry_win_rate: number;
  deaths_traded: number;
  trade_kills: number;
  impact_rating: number | null;
  impact_components: Record<string, number>;
  utility: {
    casts: Record<string, number>;
    per_round: Record<string, number>;
    total_per_round: number;
  };
}

export interface PositionPoint {
  x: number;
  y: number;
  side: string | null;
  phase: string;      // "preplant" | "postplant"
  puuid: string | null;
}
export interface PlantPoint extends PositionPoint {
  site: string | null;
}

export interface MatchAnalysis {
  our_team_id: string | null;
  players: MatchPlayerAnalysis[];
  mvp: {
    ranking: MvpEntry[];
    mvp: MvpEntry | null;
    weights?: Record<string, number>;
    weight_total?: number;
  } | null;
  positions?: {
    deaths: PositionPoint[];
    kills: PositionPoint[];
    plants: PlantPoint[];
  };
  site_tendencies?: {
    total_plants: number;
    avg_plant_time_s: number | null;
    attack_sites: Record<string, { plants: number; share: number; win_rate: number }>;
    retake_sites: Record<string, { opportunities: number; win_rate: number }>;
  } | null;
}

export interface Baseline {
  opening_duel_win_rate: number;
  deaths_traded_rate: number;
  retake_success_rate: number;
  post_plant_conversion: number;
  hold_success_rate: number;
  attack_win_rate: number;
  defense_win_rate: number;
  matches: number;
}

export interface Report {
  team: {
    id?: string;
    name?: string;
    tag?: string;
    region?: string;
    conference?: string;
    division?: number;
    place?: number;
    points?: number;
    wins?: number;
    losses?: number;
    image?: string | null;
    colors?: { primary?: string | null; secondary?: string | null; tertiary?: string | null };
  };
  matches_analyzed: number;
  trade_window_ms?: number;
  warning?: string;
  record?: { wins: number; losses: number };
  recent_form?: { result: string; started_at?: string | null }[];
  sides?: {
    attack_win_rate: number;
    defense_win_rate: number;
    attack_rounds: number;
    defense_rounds: number;
    economy: Record<string, { win_rate: number; rounds: number }>;
  };
  sites?: {
    defense: {
      round_win_rate: number;
      rounds: number;
      hold_success_rate: number;
      hold_opportunities: number;
      retake_success_rate: number;
      retake_opportunities: number;
    };
    attack: {
      round_win_rate: number;
      rounds: number;
      post_plant_conversion: number;
      plants: number;
    };
  };
  entries?: {
    opening_duel_win_rate: number;
    opening_duels: number;
    by_side: Record<string, number>;
    per_player: Record<string, { first_kills: number; first_deaths: number; entry_win_rate: number }>;
  };
  trades?: {
    deaths_traded_rate: number;
    total_deaths: number;
    tradeable_deaths: number;
    untradeable_deaths: number;
    traded_deaths: number;
    by_phase?: Record<string, { tradeable: number; traded: number; rate: number }>;
    per_player: Record<string, { deaths: number; tradeable_deaths: number; deaths_traded: number; trade_kills: number; deaths_traded_rate: number }>;
  };
  utility?: {
    note: string;
    per_player: Record<string, any>;
  };
  maps?: Record<string, { games: number; wins: number; win_rate: number; attack_round_win_rate: number; defense_round_win_rate: number }>;
  agents?: Record<string, { games: number; wins: number; win_rate: number }>;
  players?: PlayerRow[];
  mvp?: {
    ranking: MvpEntry[];
    mvp: MvpEntry | null;
    official_mvp: { puuid: string; name: string; score: number } | null;
    weights?: Record<string, number>;
    weight_total?: number;
    method?: string;
  };
  baseline?: Baseline | null;
  callouts?: Callout[];
}
