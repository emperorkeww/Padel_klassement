// Pechvogel-meter (#1005): client-side evenknie van de databank-logica.
// NIPT_MARGE spiegelt public._is_nipt, PECHMETER_DOEL en TROOST_MAX spiegelen
// _troost_delta (supabase/schemas/functions/34_pechvogel.sql).
//
// De databank blijft de enige die de demper uitkeert; dit bestand bestaat zodat
// het profiel kan tonen hoe vol de meter staat, met exact dezelfde telling als
// straks verrekend wordt.

import type { Match, Team } from "@/types";
import { outcomeFor } from "@/features/rating/results";

/** Maximaal puntenverschil dat nog "nipt" heet. Sluit aan bij de bestaande
 *  marges elders: 1 punt is een nagelbijter (feedLogic), 4+ een afdroging
 *  (maandpias.AFDROGING_DREMPEL). */
export const NIPT_MARGE = 2;

/** Zoveel nipte nederlagen op rij maken de meter vol. */
export const PECHMETER_DOEL = 3;

/** Bovengrens van de demper in ratingpunten (de DB kapt af op dit getal). */
export const TROOST_MAX = 4;

/** Het tekentje van de meter. Bewust 🐦 en niet 😢: de meter is een grap met
 *  een troostprijs, geen medelijden. */
export const PECHVOGEL_EMOJI = "🐦";

/**
 * Was dit een nípte uitslag? Beide scores ingevuld, geen gelijkspel en hooguit
 * NIPT_MARGE punten verschil. Kijkt naar score_a/score_b — de autoritaire
 * aggregaat — en niet naar set_scores: die wordt in de praktijk niet gevuld
 * (zie de toelichting in features/seizoen/awards.ts).
 */
export function isNipteUitslag(match: Match): boolean {
  const { score_a: a, score_b: b } = match;
  if (a == null || b == null) return false;
  const marge = Math.abs(a - b);
  return marge > 0 && marge <= NIPT_MARGE;
}

/** Verloor deze speler deze match nípt? */
export function isNipteNederlaag(
  match: Match,
  teams: Record<string, Team>,
  playerId: string,
): boolean {
  return outcomeFor(match, teams, playerId) === "L" && isNipteUitslag(match);
}

/** De stand van de meter van één speler. */
export interface PechMeter {
  /** Aantal nipte nederlagen op rij, ongelimiteerd doortellend. */
  reeks: number;
  /** Wat de meter toont: reeks binnen het huidige rondje (0..PECHMETER_DOEL). */
  stand: number;
  /** Staat de meter vol — en is de badge dus verdiend? */
  vol: boolean;
}

/**
 * De Pechvogel-meter van een speler, geteld vanaf zijn recentste match terug.
 * Een zege, een gelijkspel, een afdroging of een match zonder score breekt de
 * reeks.
 *
 * De `stand` telt modulo PECHMETER_DOEL, precies zoals de databank uitkeert:
 * bij de derde nederlaag is de meter vol, de vierde begint een nieuw rondje.
 * Alleen op het moment dát hij vol is (reeks 3, 6, 9, …) blijft de stand op 3
 * staan — anders zou de meter meteen weer op nul springen en zou de speler zijn
 * eigen troostmoment nooit te zien krijgen.
 */
export function pechMeter(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): PechMeter {
  const chrono = [...matches].sort((a, b) =>
    (b.played_at ?? b.created_at).localeCompare(a.played_at ?? a.created_at),
  );
  let reeks = 0;
  for (const m of chrono) {
    // Matches waar de speler niet in meedeed (of die niet afgerond zijn) laten
    // de meter met rust — ze breken de reeks niet en tellen niet mee.
    if (!outcomeFor(m, teams, playerId)) continue;
    if (!isNipteNederlaag(m, teams, playerId)) break;
    reeks++;
  }
  const rest = reeks % PECHMETER_DOEL;
  const vol = reeks > 0 && rest === 0;
  return { reeks, stand: vol ? PECHMETER_DOEL : rest, vol };
}
