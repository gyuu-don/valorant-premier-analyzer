import { useQuery } from "@tanstack/react-query";
import { fetchReport } from "./api";

// Single shared report query so every page reads from the same cache entry.
export function useReport() {
  return useQuery({ queryKey: ["report"], queryFn: () => fetchReport() });
}
