import { useQuery } from "@tanstack/react-query";
import { fetchReport } from "./api";
import { useSeason } from "./season";

// Single shared report query so every page reads from the same cache entry.
// Keyed by the selected Premier stage so switching stages refetches/filters.
export function useReport() {
  const { season } = useSeason();
  return useQuery({ queryKey: ["report", season], queryFn: () => fetchReport(season) });
}
