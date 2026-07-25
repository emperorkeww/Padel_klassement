// AI dictator-portret (#554): lazy pre-warm-logica. We genereren het portret niet
// bij elke upload, maar zodra een speler in range komt om volgende match dictator
// te worden — plus als vangnet wanneer hij daadwerkelijk zittend dictator is.
//
// Sinds #682 staan de soort-onafhankelijke helpers (portretVervallen, portretVoor,
// prewarmPortret, GEEN_AVATAR_BRON) in aiPortret.ts, omdat de pias ze deelt. Wat
// hier blijft is precies wat de dictator eigen is: de rating-drempel waarop
// pre-warmen zin heeft. De pias heeft zo'n voorspeller niet — daar is de
// client-aanroep puur een vangnet.

/** Rating-drempel voor de El Padelissimo/dictator-tier (#527). */
export const DICTATOR_DREMPEL = 1600;
/** Max. rating-winst per match: de K-factor uit de rating-trigger
 *  (supabase/schemas/functions/09_ratings.sql, `k := 24`). Verandert de K-factor
 *  ooit, pas dit mee aan. */
export const MAX_ELO_PER_MATCH = 24;
/** Absolute ondergrens om te pre-warmen: onder 1576 kun je met één match (max
 *  +24) geen 1600 halen, dus genereren we niets. */
export const PREWARM_ONDERGRENS = DICTATOR_DREMPEL - MAX_ELO_PER_MATCH; // 1576

export interface PrewarmInput {
  /** Huidige rating van de speler (null = onbekend/geen rating). */
  rating: number | null;
  /** Rating van de zittende ECHTE dictator (uit dictator_termijnen), of null als
   *  de troon vacant is of enkel door de waarnemend Mbappé (#530) bezet wordt.
   *  Zit de speler zélf op de troon, dan is dit z'n eigen rating → verschil 0. */
  echteDictatorRating: number | null;
}

/** Is deze speler in range om volgende match dictator te worden (#554)?
 *
 *  - `rating < 1576` → nee (één match haalt de 1600 niet).
 *  - Geen echte dictator (vacant / waarnemend Mbappé) → `rating ≥ 1576` volstaat:
 *    bij 1600 pak je de troon.
 *  - Wél een echte dictator met rating `R_d` → enkel als `R_d − rating ≤ 24`.
 *    Door de machtsbehoud-regel (#545) moet je strikt vóórbij `R_d`; sta je méér
 *    dan één match-winst achter, dan kun je sowieso geen dictator worden.
 *
 *  De zittende dictator zelf voldoet altijd (verschil 0 ≤ 24) → dekt meteen het
 *  vangnet: draait z'n eigen client, dan (her)genereert die z'n portret.
 */
export function magDictatorPortretGenereren({
  rating,
  echteDictatorRating,
}: PrewarmInput): boolean {
  if (rating == null || rating < PREWARM_ONDERGRENS) return false;
  if (echteDictatorRating == null) return true;
  return echteDictatorRating - rating <= MAX_ELO_PER_MATCH;
}
