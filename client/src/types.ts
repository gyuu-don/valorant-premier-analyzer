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
  };
  matches_analyzed: number;
  warning?: string;
  record?: { wins: number; losses: number };
  recent_form?: string[];
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
    traded_deaths: number;
    per_player: Record<string, { deaths: number; deaths_traded: number; trade_kills: number; deaths_traded_rate: number }>;
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
    method?: string;
  };
  callouts?: Callout[];
}
