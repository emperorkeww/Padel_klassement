// Duo-chemie (#427): hoe presteert een vast paar sámen ten opzichte van wat hun
// rating voorspelt? De maat is het gemiddelde van rating_history.delta over de
// gezamenlijke afgewerkte matches. De DB-trigger slaat per match al precies
// K × (werkelijk − verwacht) op als delta, voor beide teamgenoten hetzelfde
// (migratie 20260716125045) — herimplementeer de Elo-verwachting hier dus niet:
// dat zou een tweede formule zijn die stil uit sync kan raken met de trigger.
//
// Bekende beperking (bewust geaccepteerd): circulariteit. De individuele Elo
// van een speler is mede gevormd door de matches mét deze partner; spelen ze
// vaak samen, dan zit hun gezamenlijke prestatie al in de eigen rating verwerkt
// en wordt het residu naar 0 getrokken. Chemie wordt dus eerder onderschat dan
// overdreven. (De zuiverdere within-player-vergelijking — presteert A beter mét
// B dan met andere partners? — is buiten scope, zie #84.)
//
// Pure functie over reeds geladen data (net als profiles/headToHead.ts); ook
// bedoeld als gedeelde bouwsteen voor #84 (eerlijke teams) en #172 (chemie-
// meter), dus geen imports uit componenten of api-lagen.

import type { Match, RatingPoint, Team } from "@/types";
import { inTeam } from "@/features/rating/results";

/** Onder dit aantal gezamenlijke matches is een gemiddeld residu nog ruis.
 *  Bewust strenger dan MIN_SAMEN (3) van bestPartner: een winstpercentage
 *  kleurt sneller dan een gemiddelde Elo-delta (#84 noemt zelf 5). */
export const MIN_SAMEN_CHEMIE = 5;
/** Grens (in Elo-punten per match) vanaf waar chemie "hoog" is.
 *  Ter kalibratie: K=24, dus +3/match ≈ 12,5 procentpunt vaker winnen
 *  dan verwacht. Exported zodat hij zonder UI-wijziging te tunen is. */
export const CHEMIE_HOOG = 3;
/** Grens (in Elo-punten per match) tot waar chemie "laag" is. */
export const CHEMIE_LAAG = -3;
/** Hoeveel recente matches per speler we voor de chemie bekijken; recenter
 *  is relevanter, dus een bewust venster en geen volledige historie. */
export const CHEMIE_MATCH_LIMIT = 50;

export type ChemieNiveau = "hoog" | "midden" | "laag" | "onbekend";

export interface Chemie {
  /** Gezamenlijk gespeelde afgewerkte matches. */
  samen: number;
  /** Gemiddelde Elo-delta per gezamenlijke match; + = boven verwachting. */
  gemiddeldeDelta: number;
  niveau: ChemieNiveau;
}

/**
 * Chemie van het duo a+b over de gegeven matches, of null zonder duo
 * (singles-team, ontbrekende/verwijderde speler, of a === b).
 */
export function chemie(
  matches: Match[],
  teams: Record<string, Team>,
  histories: Record<string, RatingPoint[]>,
  aId: string | null | undefined,
  bId: string | null | undefined,
): Chemie | null {
  if (!aId || !bId || aId === bId) return null;

  let samen = 0;
  let deltaSom = 0;
  let deltaN = 0;
  for (const m of matches) {
    // Alleen afgewerkte matches: voor geplande bestaat er geen delta.
    if (m.status !== "completed") continue;
    const zelfdeTeam = [teams[m.team_a_id], teams[m.team_b_id]].some(
      (t) => t && inTeam(t, aId) && inTeam(t, bId),
    );
    if (!zelfdeTeam) continue;
    samen++;
    // Beide teamgenoten kregen dezelfde delta; B is de vangnet-rij voor als
    // A's historie weg is (verwijderde speler).
    const punt =
      histories[aId]?.find((h) => h.match_id === m.id) ??
      histories[bId]?.find((h) => h.match_id === m.id);
    if (punt) {
      deltaSom += punt.delta;
      deltaN++;
    }
  }

  const gemiddeldeDelta = deltaN > 0 ? deltaSom / deltaN : 0;
  let niveau: ChemieNiveau = "midden";
  if (samen < MIN_SAMEN_CHEMIE) niveau = "onbekend";
  else if (gemiddeldeDelta >= CHEMIE_HOOG) niveau = "hoog";
  else if (gemiddeldeDelta <= CHEMIE_LAAG) niveau = "laag";
  return { samen, gemiddeldeDelta, niveau };
}
