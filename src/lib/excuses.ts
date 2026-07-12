// Smoesjesmachine (#167): na een verloren match één tik → een willekeurig,
// ludiek excuus. Puur client-side, geen data — een vaste NL-lijst met een
// deterministische keuze op een seed, zodat dezelfde (match, worp) altijd
// hetzelfde smoesje geeft en "opnieuw" een nieuwe trekt.

/** De volledige smoezenpool. Zelfspottend en plagend — donker mag, echt
 *  beledigend of grof nooit. */
export const SMOESJES: string[] = [
  "Mijn gripje was veel te glad, m'n racket gleed zó uit m'n hand.",
  "De glazen wanden waren vandaag opvallend stroef.",
  "Ik had gisteren legday, m'n benen voelden letterlijk als beton.",
  "M'n partner stond constant in mijn weg te zwaaien.",
  "Die ballen waren veel te zacht, alsof we met tennisballen speelden.",
  "De tegenstanders waren stiekem linkshandig. Dat is gewoon niet eerlijk.",
  "Ik had m'n racket blijkbaar verkeerd vast bij die beslissende lobs.",
  "Het veld was vandaag echt abnormaal snel.",
  "Die lampen stonden zó fel afgesteld dat ik verblind werd.",
  "De tegenstanders speelden elk punt via het glas. Dat is toch geen echt padel?",
  "We hadden gewoon zware pech met de netband vandaag.",
  "Ik had te veel koffie op en trilde m'n racket zowat uit.",
  "Mijn schoenen hadden nul grip op dit kunstgras.",
  "Het was veel te koud voor fatsoenlijke spinballen.",
  "Mijn racket trilde te veel bij elke impact.",
  "Ik was gewoon te sportief en sloeg ze allemaal recht op hun racket.",
  "Hun tactiek was puur geluk en windvlagen.",
  "De wind waaide al mijn perfecte effectballen de kooi uit.",
  "De tegenstanders bleven maar praten. Psychologische oorlogsvoering, noem ik dat.",
  "Ik zat er met m'n hoofd al op café.",
  "M'n motivatie checkte na de eerste opslag alweer uit.",
  "Verloren, maar mét stijl. Dat telt toch ook?",
  "Nederlagen bouwen karakter. Ik zit ondertussen bomvol karakter.",
  "M'n beste shots bewaar ik voor in m'n dromen.",
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
