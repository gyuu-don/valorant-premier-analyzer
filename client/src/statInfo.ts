// Central definitions for every stat surfaced in the UI. Keyed by a short slug;
// `label` is the canonical name and `desc` explains the stat + its calculation.
// Used by <InfoLabel> to render consistent hover/focus tooltips everywhere.

export interface StatDef {
  label: string;
  desc: string;
}

export const STAT_INFO: Record<string, StatDef> = {
  // Core per-player
  acs: { label: "ACS", desc: "Average Combat Score: total combat score ÷ rounds played." },
  adr: { label: "ADR", desc: "Average Damage per Round: total damage dealt ÷ rounds played." },
  kd: { label: "K/D", desc: "Kill/Death ratio: kills ÷ deaths." },
  kast: {
    label: "KAST",
    desc: "Share of rounds where the player got a Kill, an Assist, Survived, or was Traded.",
  },
  hs_pct: {
    label: "HS%",
    desc: "Headshot percentage: headshots ÷ (headshots + bodyshots + legshots).",
  },
  kills: { label: "Kills", desc: "Total kills." },
  deaths: { label: "Deaths", desc: "Total deaths." },
  assists: { label: "Assists", desc: "Total assists (damage or utility that contributed to a teammate's kill)." },
  score: { label: "Score", desc: "Riot combat score for the match (drives the in-game MVP)." },
  kda: { label: "K / D / A", desc: "Kills / Deaths / Assists for this game." },
  multikills: { label: "Multikills", desc: "Rounds in which the player got 2 or more kills." },
  clutches: {
    label: "Clutches",
    desc: "Rounds won as the last player alive on the team (heuristic: sole survivor who secured a kill).",
  },

  // Entries / trades
  opening_duel: {
    label: "Opening-duel win rate",
    desc: "Share of rounds where your team won the first kill of the round (first blood for vs against).",
  },
  entry_win_rate: {
    label: "Entry win %",
    desc: "A player's first-engagement success: first kills ÷ (first kills + first deaths).",
  },
  first_kills: { label: "First kills", desc: "Times the player secured the round's first kill." },
  first_deaths: { label: "First deaths", desc: "Times the player was the round's first death." },
  deaths_traded_rate: {
    label: "Deaths traded",
    desc: "How trades are found: kills are timestamped within each round, so a death counts as TRADED when a teammate kills the exact enemy who killed you within the trade window ({TRADE_S}s) of your death. Rate = traded deaths ÷ tradeable deaths; last-man-standing deaths (no teammate alive to trade) are excluded from the denominator.",
  },
  tradeable_deaths: {
    label: "Tradeable deaths",
    desc: "Deaths that could possibly be traded — at least one teammate was still alive at the moment you died (determined from the round's kill order). Last-man-standing deaths can't be traded and are excluded from the trade rate.",
  },
  trade_kills: {
    label: "Trade kills",
    desc: "Kills that register as a trade: you killed the enemy who had just killed a teammate, within the trade window ({TRADE_S}s) of that teammate's death — matched using in-round kill timestamps.",
  },

  // Site play
  retake_success: {
    label: "Retake success",
    desc: "Defense rounds won AFTER the enemy planted the spike ÷ all defense rounds where the enemy planted.",
  },
  hold_success: {
    label: "Hold success",
    desc: "Defense rounds won with NO enemy plant ÷ defense rounds where the enemy never planted.",
  },
  post_plant_conversion: {
    label: "Post-plant conversion",
    desc: "Attack rounds won after YOUR team planted ÷ rounds your team planted.",
  },

  // Sides / economy
  attack_win_rate: {
    label: "Attack RWR",
    desc: "Attack-side round win rate. Side per round is inferred from spike plants + the standard 12/12 half structure.",
  },
  defense_win_rate: {
    label: "Defense RWR",
    desc: "Defense-side round win rate. Side per round is inferred from spike plants + the standard 12/12 half structure.",
  },
  eco: { label: "Eco", desc: "Round win rate when the team's average loadout value was under 2000 credits." },
  force: { label: "Force", desc: "Round win rate when the team's average loadout value was 2000–3900 credits." },
  full_buy: { label: "Full buy", desc: "Round win rate when the team's average loadout value was 3900+ credits." },

  // Maps / agents
  win_rate: { label: "Win rate", desc: "Matches won ÷ matches played." },
  attack_round_win_rate: { label: "Attack RWR", desc: "Attack-side round win rate on this map." },
  defense_round_win_rate: { label: "Defense RWR", desc: "Defense-side round win rate on this map." },
  games: { label: "Games", desc: "Number of matches played." },

  // MVP / impact
  impact_rating: {
    label: "Impact",
    desc: "Composite 0–100 rating blending ACS, KAST, entry win rate, trade contribution, multikills, clutches and ADR — each normalized across the roster and weighted. See the Advanced Team MVP explainer.",
  },

  // Team-level
  record: { label: "Record", desc: "Wins–losses across the matches analyzed (differs from the official Premier standing)." },
  recent_form: { label: "Recent form", desc: "Recent match results, ordered oldest → most recent (newest is marked)." },

  // Spike sites (this match)
  plant_site_dist: {
    label: "Plant share",
    desc: "Share of your team's attack-side spike plants that went to this site, this match.",
  },
  site_win_rate: {
    label: "Win rate",
    desc: "Round win rate when your team planted the spike on this site (attack side), this match.",
  },
  retake_by_site: {
    label: "Retake win rate",
    desc: "Defense rounds won after the enemy planted on this site ÷ times they planted there, this match.",
  },
  avg_plant_time: {
    label: "Avg plant time",
    desc: "Average in-round time at which your team planted the spike (seconds from round start).",
  },

  // Utility (per-match, usage only)
  utility_usage: {
    label: "Utility usage",
    desc: "Ability casts per round for this game (per-match cast total ÷ rounds). Ability casts have no timestamps in the API, so this is usage only — it can't be linked to kills/assists.",
  },
};
