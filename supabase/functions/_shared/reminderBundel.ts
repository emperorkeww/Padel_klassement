// Bundelt de herinneringen van één speeldag (#827). Sinds gegenereerde rondes
// een echte starttijd meekrijgen, valt een hele avond binnen het
// herinneringsvenster: acht rondes zouden acht pushes per speler opleveren.
// Eén herinnering per groep per speeldag is genoeg — de rest van die avond
// wordt meteen als afgehandeld weggeschreven zodat ze later niet alsnog afgaan.
//
// Pure logica, zonder Deno-globals: getest in reminderBundel.test.ts.

import { dagInZone } from "./klok.ts";

/** Het minimum dat deze module van een match nodig heeft. */
export interface BundelbareMatch {
  id: string;
  group_id: string | null;
  played_at: string;
}

export interface Speeldagbundel<T> {
  /** De vroegste match: hiervoor gaat de push de deur uit. */
  herinner: T;
  /** De rest van die groepsdag: stil afvinken, geen push. */
  onderdruk: T[];
}

/**
 * Groepeert matches per groep + speeldag en wijst per bundel de vroegste aan.
 * Matches zonder groep blijven op zichzelf staan: dat zijn losse afspraken,
 * geen ronde, en die verdienen elk hun eigen herinnering.
 */
export function bundelPerSpeeldag<T extends BundelbareMatch>(
  matches: T[],
  timeZone: string,
): Speeldagbundel<T>[] {
  const bundels = new Map<string, T[]>();
  for (const m of matches) {
    const sleutel = m.group_id
      ? `g:${m.group_id}|${dagInZone(m.played_at, timeZone)}`
      : `m:${m.id}`;
    const bestaand = bundels.get(sleutel);
    if (bestaand) bestaand.push(m);
    else bundels.set(sleutel, [m]);
  }

  return [...bundels.values()].map((groep) => {
    // Op tijd sorteren, met het id als tiebreak zodat de keuze stabiel is
    // wanneer alle rondes op hetzelfde moment zouden staan.
    const gesorteerd = [...groep].sort(
      (a, b) => a.played_at.localeCompare(b.played_at) || a.id.localeCompare(b.id),
    );
    return { herinner: gesorteerd[0], onderdruk: gesorteerd.slice(1) };
  });
}
