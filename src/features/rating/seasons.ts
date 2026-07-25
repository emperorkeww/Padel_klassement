// Kwartaal-seizoenen voor het klassement: elk kalenderkwartaal (Q1 = jan–mrt,
// … Q4 = okt–dec) is een seizoen met een eigen stand en kampioen.
// Puur datumrekenen — geen data-toegang.

export interface Season {
  /** Bv. "2026-q3" — leeft ook in de URL (?seizoen=). */
  id: string;
  /** Bv. "Q3 2026". */
  label: string;
  /** Begin van het kwartaal (inclusief), in lokale tijd. */
  start: Date;
  /** Begin van het volgende kwartaal (exclusief). */
  end: Date;
}

const ID_PATTERN = /^(\d{4})-q([1-4])$/;

/** Valideert en ontleedt een seizoen-id; null bij een ongeldige waarde. */
export function parseSeasonId(
  id: string,
): { year: number; quarter: number } | null {
  const m = ID_PATTERN.exec(id);
  if (!m) return null;
  return { year: Number(m[1]), quarter: Number(m[2]) };
}

function makeSeason(year: number, quarter: number): Season {
  return {
    id: `${year}-q${quarter}`,
    label: `Q${quarter} ${year}`,
    start: new Date(year, (quarter - 1) * 3, 1),
    // Maandindex 12 rolt in JS vanzelf door naar januari van het volgende jaar.
    end: new Date(year, quarter * 3, 1),
  };
}

/** Season bij een id (bv. uit de URL), of null bij een ongeldig id. */
export function seasonFromId(id: string): Season | null {
  const parsed = parseSeasonId(id);
  return parsed ? makeSeason(parsed.year, parsed.quarter) : null;
}

/** Het seizoen (kwartaal) waarin een datum valt. */
export function seasonFor(date: Date): Season {
  return makeSeason(date.getFullYear(), Math.floor(date.getMonth() / 3) + 1);
}

/** Alle kwartalen van `from` tot en met `now`, nieuwste eerst. */
export function listSeasons(from: Date, now: Date = new Date()): Season[] {
  // Kwartalen doortellen als year*4 + kwartaalindex, zodat de jaarwissel
  // geen apart geval is.
  const first = from.getFullYear() * 4 + Math.floor(from.getMonth() / 3);
  const last = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3);
  const seasons: Season[] = [];
  for (let n = last; n >= first; n--) {
    seasons.push(makeSeason(Math.floor(n / 4), (n % 4) + 1));
  }
  return seasons;
}

/** Is het kwartaal volledig voorbij (en heeft het dus een kampioen)? */
export function isSeasonClosed(season: Season, now: Date = new Date()): boolean {
  return now >= season.end;
}

/** Alleen de kwartalen die al voorbij zijn, nieuwste eerst — de seizoenen die
 *  een kampioen hébben (eregalerij, #711). */
export function afgeslotenSeizoenen(from: Date, now: Date = new Date()): Season[] {
  return listSeasons(from, now).filter((s) => isSeasonClosed(s, now));
}

/** Seizoensnaam per kwartaal, op de meteorologische seizoenen van de Benelux
 *  (#474): Q1 (jan–mrt) valt in de winter, Q2 (apr–jun) in de lente, Q3
 *  (jul–sep) in de zomer en Q4 (okt–dec) in de herfst. Index = kwartaal − 1. */
const SEIZOEN_NAMEN = [
  { naam: "Winter", emoji: "❄️" },
  { naam: "Lente", emoji: "🌱" },
  { naam: "Zomer", emoji: "☀️" },
  { naam: "Herfst", emoji: "🍂" },
] as const;

export interface SeizoenNaam {
  /** Bv. "☀️". */
  emoji: string;
  /** Bv. "Zomer". */
  naam: string;
  /** Bv. "Zomer 2026" — zonder emoji, voor posters en deel-teksten. */
  titel: string;
  /** Bv. "☀️ Zomer 2026" — de volle vorm voor koppen in de UI. */
  label: string;
}

/**
 * De sfeernaam van een kwartaal ("☀️ Zomer 2026"), voor de eregalerij, het
 * kwartaal-Wrapped (#712) en de posters. Bewust náást `Season.label`
 * ("Q3 2026") en niet in de plaats ervan: de kampioen-editie op de FUT-kaart
 * draagt dat korte label en zit daar al op de maatgrens (#654/#665).
 */
export function seizoenNaam(season: Season): SeizoenNaam {
  const parsed = parseSeasonId(season.id);
  // Een Season komt altijd uit makeSeason en heeft dus een geldig id; de
  // terugval houdt de functie totaal, zonder een niet-testbare throw.
  const { naam, emoji } = SEIZOEN_NAMEN[(parsed?.quarter ?? 1) - 1];
  const jaar = parsed?.year ?? season.start.getFullYear();
  return { emoji, naam, titel: `${naam} ${jaar}`, label: `${emoji} ${naam} ${jaar}` };
}
