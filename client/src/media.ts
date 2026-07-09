// Player-card ("banner") square art from the valorant-api media CDN, keyed by card UUID.
export const playerCardImage = (card?: string | null) =>
  card ? `https://media.valorant-api.com/playercards/${card}/smallart.png` : null;
