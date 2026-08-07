// Sets tegen de eindstand leggen (#1144).
//
// `set_scores` is puur decoratief: score_a/score_b blijven "de autoritaire
// aggregaat voor stand en ratings" (zie supabase/schemas/tables/05_matches.sql),
// en de databank valideert aan de set-stand niets meer dan dat het een array is.
// Je kon dus 6-4 / 3-6 / 6-2 invullen én 1-9 als eindstand opslaan.
//
// Bewust géén afleiding van de eindscore uit de sets. Twee redenen:
//
//   1. Het is niet vast te stellen wát score_a/score_b betekenen. In de praktijk
//      logt de ene groep de games van één set (6-4) en de andere het totaal over
//      alle sets (15-12). Een som-controle zou bij de eerste groep permanent
//      afgaan.
//   2. Elders in de app zijn die cijfers wél games: `scoreHighlight` leest een
//      bagel als "de verliezer pakte geen enkele game" en een monsterzege als
//      MONSTERZEGE_DREMPEL games verschil. Er sets-gewonnen van maken zou die
//      drempels en alle historische data breken.
//
// Wat er overblijft is de controle die altijd klopt, ongeacht welke van beide
// conventies je aanhoudt: **wijzen de sets een andere winnaar aan dan de
// eindstand?** Dat is geen smaakverschil maar een invoerfout — de rating gaat
// dan de verkeerde kant op. Alleen dán waarschuwen we, en opslaan mag nog steeds.

import type { SetScore } from "./api";

/** Wie won er volgens deze sets? null = evenveel sets, dus geen uitspraak. */
export function setsWinnaar(sets: SetScore[]): "a" | "b" | null {
  let a = 0;
  let b = 0;
  for (const [ga, gb] of sets) {
    if (ga > gb) a++;
    else if (gb > ga) b++;
  }
  if (a === b) return null;
  return a > b ? "a" : "b";
}

/**
 * Een waarschuwing als de set-stand en de eindstand een andere winnaar
 * aanwijzen; null als ze niet botsen of als er niets te vergelijken valt.
 *
 * De tekst noemt beide kanten bij naam — "dit klopt niet" zonder te zeggen wát
 * er niet klopt laat de invuller zoeken.
 */
export function setsWaarschuwing(opts: {
  sets: SetScore[];
  scoreA: number | null;
  scoreB: number | null;
  labelA: string;
  labelB: string;
}): string | null {
  const { sets, scoreA, scoreB, labelA, labelB } = opts;
  if (sets.length === 0 || scoreA == null || scoreB == null) return null;

  const volgensSets = setsWinnaar(sets);
  if (volgensSets == null) return null;

  const volgensScore = scoreA > scoreB ? "a" : scoreB > scoreA ? "b" : null;
  if (volgensScore === volgensSets) return null;

  const setsNaam = volgensSets === "a" ? labelA : labelB;
  if (volgensScore == null) {
    return `Volgens de sets wint ${setsNaam}, maar de eindstand is gelijk. Klopt dat?`;
  }
  const scoreNaam = volgensScore === "a" ? labelA : labelB;
  return `Volgens de sets wint ${setsNaam}, maar de eindstand geeft de winst aan ${scoreNaam}. Klopt dat?`;
}

/**
 * Is deze invoer op te slaan? Eén plek, zodat het formulier en de opslagknop
 * het niet los uitrekenen — en zodat "0 is een geldige score" niet ergens
 * stilletjes een lege string wordt.
 */
export function scoreGeldig(scoreA: string, scoreB: string): boolean {
  const a = scoreA === "" ? null : Number(scoreA);
  const b = scoreB === "" ? null : Number(scoreB);
  return a !== null && b !== null && a >= 0 && b >= 0;
}
