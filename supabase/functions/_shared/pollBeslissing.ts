// Welk moment legt de cron vast — en wanneer gaat de speeldag niet door
// (#1234)? Pure logica, zonder Deno-globals; de aanroeper zit in
// ../poll-deadline/index.ts.
//
// Vóór #1234 lockte de cron al bij één ja-stem: twee man volstond om een avond
// als bevestigde speeldag in de agenda te zetten, waarna `zetRondesKlaar` er
// wegens `< 4` geen enkele ronde in zette. Een speeldag zonder baanbezetting
// dus. Nu telt een moment pas mee met genoeg volk voor één baan.

/** Spelers die minstens moeten opdagen: één volle baan. Spiegel van
 *  `PLAYERS_PER_COURT` in src/features/groups/pollLogic.ts. */
export const MIN_SPELERS = 4;

/** Eén kandidaat-moment, geteld. `ja`/`misschien` zijn aantallen unieke
 *  spelers; `startMs` is de starttijd in clubtijd (epoch ms). */
export interface MomentTelling {
  optionId: string;
  ja: number;
  misschien: number;
  courtsFree: number | null;
  startMs: number;
}

/** Banen die dit moment nodig heeft. Op de ja-stemmers: banen zijn bij te
 *  boeken en de misschiens komen niet allemaal. Spiegel van `courtsNeeded`. */
function banenNodig(ja: number): number {
  return Math.max(1, Math.ceil(ja / MIN_SPELERS));
}

/**
 * Haalt dit moment de drempel? Ja én misschien tellen mee: wie twijfelt is
 * geen halve speler, en met vier twijfelaars gaat de avond door — die stemmen
 * schuiven vóór de speeldag meestal alsnog op naar ja of nee.
 */
export function haaltDrempel(m: MomentTelling): boolean {
  return m.ja + m.misschien >= MIN_SPELERS;
}

/**
 * Het moment dat de cron vastlegt, of `null` als de speeldag niet door kan
 * gaan. Twee voorwaarden, allebei nodig:
 *
 * 1. **Genoeg volk** (`haaltDrempel`) — anders staat er straks een avond in de
 *    agenda waar geen wedstrijd in past.
 * 2. **Genoeg baan** volgens de momentopname van Playtomic (`courts_free`).
 *    Onbekend telt als haalbaar: dan weten we het gewoon niet.
 *
 * Winnaar is het moment met de meeste ja-stemmen — misschiens laten een moment
 * meedoen, ze laten het niet winnen. Bij gelijkspel wint het vroegste moment;
 * zonder die tie-break hing de uitkomst aan de volgorde waarin Postgres de
 * opties teruggaf.
 */
export function kiesMoment(momenten: MomentTelling[]): MomentTelling | null {
  const kandidaten = momenten.filter(
    (m) =>
      haaltDrempel(m) &&
      (m.courtsFree == null || m.courtsFree >= banenNodig(m.ja)),
  );
  if (kandidaten.length === 0) return null;
  return [...kandidaten].sort((a, b) => b.ja - a.ja || a.startMs - b.startMs)[0];
}
