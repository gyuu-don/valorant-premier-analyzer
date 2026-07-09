import { createContext, useContext, type ReactNode } from "react";

// Dynamic values interpolated into stat tooltips (e.g. the configured trade window).
interface StatParams {
  tradeWindowMs: number;
}

const StatParamsContext = createContext<StatParams>({ tradeWindowMs: 3000 });

export function StatParamsProvider({
  value,
  children,
}: {
  value: StatParams;
  children: ReactNode;
}) {
  return <StatParamsContext.Provider value={value}>{children}</StatParamsContext.Provider>;
}

export const useStatParams = () => useContext(StatParamsContext);

export function fmtSeconds(ms: number): string {
  const s = ms / 1000;
  return Number.isInteger(s) ? String(s) : s.toFixed(1);
}
