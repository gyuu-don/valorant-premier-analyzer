// Agent portrait icons from the public valorant-api.com API (CORS-enabled).
// Fetched once and cached; we look up the display icon by agent name (case-insensitive).

export async function fetchAgentIcons(): Promise<Record<string, string>> {
  const res = await fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true");
  if (!res.ok) throw new Error(`agents fetch failed: ${res.status}`);
  const body = await res.json();
  const map: Record<string, string> = {};
  for (const a of body.data ?? []) {
    if (a.displayName && a.displayIcon) {
      map[a.displayName.toLowerCase()] = a.displayIcon;
    }
  }
  return map;
}
