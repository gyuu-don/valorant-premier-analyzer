// Agent portrait icons from the public valorant-api.com API (CORS-enabled).
// Fetched once and cached; we look up the display icon by agent name (case-insensitive).

export interface AgentAbility {
  name: string;
  icon: string | null;
}
export interface AgentInfo {
  icon: string | null;
  // keyed to match `ability_casts` slots: grenade / ability1 / ability2 / ultimate
  abilities: Record<string, AgentAbility>;
}

export interface IconLookup {
  agentIcons: Record<string, string>;
  roleIcons: Record<string, string>;
}

// valorant-api slot -> match ability_casts key
const SLOT_MAP: Record<string, string> = {
  Grenade: "grenade",
  Ability1: "ability1",
  Ability2: "ability2",
  Ultimate: "ultimate",
};

export async function fetchAgents(): Promise<Record<string, AgentInfo>> {
  const res = await fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true");
  if (!res.ok) throw new Error(`agents fetch failed: ${res.status}`);
  const body = await res.json();
  const map: Record<string, AgentInfo> = {};
  for (const a of body.data ?? []) {
    if (!a.displayName) continue;
    const abilities: Record<string, AgentAbility> = {};
    for (const ab of a.abilities ?? []) {
      const key = SLOT_MAP[ab.slot];
      if (key) abilities[key] = { name: ab.displayName, icon: ab.displayIcon ?? null };
    }
    map[a.displayName.toLowerCase()] = { icon: a.displayIcon ?? null, abilities };
  }
  return map;
}

export async function fetchAgentIcons(): Promise<IconLookup> {
  const res = await fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true");
  if (!res.ok) throw new Error(`agents fetch failed: ${res.status}`);
  const body = await res.json();
  const agentIcons: Record<string, string> = {};
  const roleIcons: Record<string, string> = {};
  for (const a of body.data ?? []) {
    if (a.displayName && a.displayIcon) {
      agentIcons[a.displayName.toLowerCase()] = a.displayIcon;
    }
    if (a.role?.displayName && a.role?.displayIcon) {
      roleIcons[a.role.displayName.toLowerCase()] = a.role.displayIcon;
    }
  }
  return { agentIcons, roleIcons };
}
