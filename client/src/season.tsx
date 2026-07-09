import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStages, type Stage } from "./api";

// "all" means no stage filter; otherwise the selected Premier stage id.
interface SeasonContextValue {
  season: string;
  setSeason: (s: string) => void;
  stages: Stage[];
  loading: boolean;
}

const SeasonContext = createContext<SeasonContextValue>({
  season: "all",
  setSeason: () => {},
  stages: [],
  loading: false,
});

export function SeasonProvider({ children }: { children: ReactNode }) {
  const stagesQuery = useQuery({ queryKey: ["stages"], queryFn: fetchStages, staleTime: Infinity });
  const stages = stagesQuery.data?.stages ?? [];

  const [season, setSeasonState] = useState<string>("all");
  const [touched, setTouched] = useState(false);

  // Default to the current (most-recent) stage once stages load, unless the user picked one.
  useEffect(() => {
    if (!touched && stages.length > 0) setSeasonState(stages[0].id);
  }, [stages, touched]);

  const setSeason = (s: string) => {
    setTouched(true);
    setSeasonState(s);
  };

  return (
    <SeasonContext.Provider value={{ season, setSeason, stages, loading: stagesQuery.isLoading }}>
      {children}
    </SeasonContext.Provider>
  );
}

export const useSeason = () => useContext(SeasonContext);

export function stageLabel(stage: Stage): string {
  const fmt = (d: string) => {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const year = new Date(stage.starts_at).getFullYear();
  const code = stage.short ? stage.short.toUpperCase() : "Stage";
  return `${code} · ${fmt(stage.starts_at)} – ${fmt(stage.ends_at)}, ${year}`;
}
