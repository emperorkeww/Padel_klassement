// Smoesjesmachine (#167): na een verloren match één tik → een willekeurig,
// ludiek excuus. Puur client-side, geen data — een vaste NL-lijst met een
// deterministische keuze op een seed, zodat dezelfde (match, worp) altijd
// hetzelfde smoesje geeft en "opnieuw" een nieuwe trekt.

/** De volledige smoezenpool. Plagend, nooit echt beledigend. */
export const SMOESJES: string[] = [
  "De zon stond verkeerd.",
  "Nieuwe schoenen, nog niet ingelopen.",
  "M'n maat sliep nog half.",
  "Het net stond te hoog.",
  "De ballen waren te licht.",
  "Mijn racket was niet goed opgespannen.",
  "Te veel wind op de baan.",
  "Ik was m'n dag gewoon niet.",
  "De baan was nog een beetje nat.",
  "Ik had te veel gegeten voor de match.",
  "De verlichting flikkerde de hele tijd.",
  "Warming-up overgeslagen, foutje.",
  "Mijn bril besloeg constant.",
  "Ik gaf ze bewust een kansje.",
  "Powernap gemist vanmiddag.",
  "Verkeerde snaren in m'n racket.",
  "De wind zat tegen — aan béíde kanten.",
  "M'n koffie was nog niet op.",
  "De tegenstander had gewoon geluk.",
  "Ik spaarde m'n energie voor de volgende keer.",
];

/**
 * Kleine deterministische hash van een string (djb2-variant), zodat een
 * match-id in een stabiele seed omgezet kan worden zonder dependency.
 */
export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/** Kiest deterministisch één smoesje uit de pool op basis van `seed`. */
export function kiesSmoes(seed: number): string {
  const i = ((seed % SMOESJES.length) + SMOESJES.length) % SMOESJES.length;
  return SMOESJES[i];
}
