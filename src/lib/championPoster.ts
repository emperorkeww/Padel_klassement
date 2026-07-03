// Inhoud van de kampioensposter voor een afgesloten seizoen: puur datawerk
// (geen canvas), zodat de opbouw los van het tekenen testbaar is.

export type PosterRow = { name: string; points: number };

export type ChampionPoster = {
  /** Bv. "Q2 2026". */
  seasonLabel: string;
  /** Naam van de nummer 1 van het seizoen. */
  champion: string;
  /** Podium: top 3 (of minder) met plaats en punten. */
  podium: { place: number; name: string; points: number }[];
};

/** Posterinhoud uit de eindstand (gesorteerd, nummer 1 eerst); null zonder spelers. */
export function championPoster(
  seasonLabel: string,
  rows: PosterRow[],
): ChampionPoster | null {
  if (rows.length === 0) return null;
  return {
    seasonLabel,
    champion: rows[0].name,
    podium: rows
      .slice(0, 3)
      .map((r, i) => ({ place: i + 1, name: r.name, points: r.points })),
  };
}
