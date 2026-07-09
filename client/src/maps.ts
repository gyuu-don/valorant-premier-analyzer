// Map splash images from the public valorant-api.com media CDN, keyed by the stable
// Riot map UUIDs. Names come from the HenrikDev match metadata (`metadata.map.name`).
// If a map isn't in this table (new map, odd casing) we fall back to a gradient in CSS.

const MAP_UUIDS: Record<string, string> = {
  ascent: "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319",
  bind: "2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba",
  haven: "2bee0dc9-4ffe-519b-1cbd-7fbe763a6047",
  split: "d960549e-485c-e861-8d71-aa9d1aed12a2",
  icebox: "e2ad5c54-4114-a870-9641-8ea21279579a",
  breeze: "2fb9a4fd-47b8-4e7d-a969-74b4046ebd53",
  fracture: "b529448b-4d60-346e-e89e-00a4c527a405",
  pearl: "fd267378-4d1d-484f-ff52-77821ed10dc2",
  lotus: "2fe4ed3a-450a-948b-6d6b-e89a78e680a9",
  sunset: "92584fbe-486a-b1b2-9faa-39b0f486b498",
  abyss: "224b0a95-48b9-f703-1bd8-67aca101a61f",
};

export function mapImage(name?: string | null): string | null {
  if (!name) return null;
  const uuid = MAP_UUIDS[name.trim().toLowerCase()];
  return uuid ? `https://media.valorant-api.com/maps/${uuid}/splash.png` : null;
}
