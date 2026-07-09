import { useQuery } from "@tanstack/react-query";
import { fetchReport } from "./api";
import { useSeason } from "./season";

// Single shared report query so every page reads from the same cache entry.
// Keyed by the selected Premier stage so switching stages refetches/filters.
export function useReport() {
  const { season } = useSeason();
  return useQuery({ queryKey: ["report", season], queryFn: () => fetchReport(season) });
}

// The report for the stage immediately before the selected one (for delta indicators).
// Returns undefined data when "All stages" is selected or the selected stage is the oldest.
// `stages` from the season context are sorted most-recent first, so the previous stage
// is the next entry after the selected one.
export function usePreviousReport() {
  const { season, stages } = useSeason();
  const idx = stages.findIndex((s) => s.id === season);
  const prevStage = season !== "all" && idx >= 0 ? stages[idx + 1] : undefined;
  const query = useQuery({
    queryKey: ["report", prevStage?.id ?? "__none__"],
    queryFn: () => fetchReport(prevStage!.id),
    enabled: !!prevStage,
  });
  return { data: prevStage ? query.data : undefined, stage: prevStage };
}
