// Filterlogica van de namenkiezer op de Vandaag-tab (#1089).
//
// Los van het component omdat het de enige plek is waar de drie keuzes van de
// kaart samenkomen: de filtertab (iedereen / aanwezig / afwezig), de zoekterm
// en wie er aan staat. Puur en zonder React, dus het gedrag is per geval te
// testen zonder een kaart te renderen.

export type KiezerFilter = "alles" | "aan" | "uit";

export interface KiesbareSpeler {
  id: string;
  /** Weergavenaam zoals hij in de chip staat — ook waarop gezocht wordt. */
  naam: string;
}

/**
 * De spelers die na filtertab én zoekterm overblijven, in de volgorde waarin
 * ze binnenkwamen.
 *
 * De filtertab is bewust een wérklijst en geen momentopname: wie je uitzet
 * terwijl "Aanwezig" actief staat, verdwijnt meteen uit de lijst. Dat is het
 * hele punt van die tab — je werkt hem af tot er niemand meer bij staat die er
 * niet hoort.
 */
export function zichtbareSpelers(
  spelers: readonly KiesbareSpeler[],
  {
    zoek,
    filter,
    gekozen,
  }: { zoek: string; filter: KiezerFilter; gekozen: ReadonlySet<string> },
): KiesbareSpeler[] {
  const term = zoek.trim().toLowerCase();
  return spelers.filter((speler) => {
    const aan = gekozen.has(speler.id);
    if (filter === "aan" && !aan) return false;
    if (filter === "uit" && aan) return false;
    return !term || speler.naam.toLowerCase().includes(term);
  });
}

/**
 * De voet onder de chips: "Ciska, Gilles, Brecht +2".
 *
 * Namen boven `max` worden geteld in plaats van opgesomd — de regel staat op
 * één regel met ellipsis, en een lijst van twaalf namen die halverwege afkapt
 * vertelt je minder dan een getal.
 */
export function afwezigLabel(namen: readonly string[], max = 3): string {
  if (namen.length === 0) return "";
  const kop = namen.slice(0, max).join(", ");
  return namen.length > max ? `${kop} +${namen.length - max}` : kop;
}
