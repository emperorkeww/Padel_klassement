// Smoesjesmachine (#167): na een verloren match één tik → een willekeurig,
// ludiek excuus. Puur client-side, geen data — een vaste NL-lijst met een
// deterministische keuze op een seed, zodat dezelfde (match, worp) altijd
// hetzelfde smoesje geeft en "opnieuw" een nieuwe trekt.

/** De volledige smoezenpool. Zelfspottend en plagend — donker mag, echt
 *  beledigend of grof nooit. */
export const SMOESJES: string[] = [
  "De zon scheen recht in m'n ego.",
  "M'n racket had er duidelijk geen zin meer in.",
  "Ik liet ze winnen, puur uit medelijden.",
  "De ballen luisterden gewoon niet naar mij.",
  "Statistisch gezien moest er íémand verliezen. Blijkbaar altijd ik.",
  "M'n vorm ligt nog bij de stomerij.",
  "Ik gaf 110% — jammer genoeg langs de verkeerde kant van het net.",
  "M'n partner was de handicap. Ik niet. Echt niet.",
  "Ik train enkel voor de derde set, en die kwam er nooit.",
  "M'n rug, m'n knie en m'n excuses zijn even versleten.",
  "De tegenstander speelde vals: die was gewoon beter.",
  "Ik zat er met m'n hoofd al op café.",
  "M'n motivatie checkte na de eerste opslag alweer uit.",
  "Verloren, maar mét stijl. Dat telt toch ook?",
  "Nederlagen bouwen karakter. Ik zit ondertussen bomvol karakter.",
  "M'n beste shots bewaar ik voor in m'n dromen.",
  "De wind zat tegen — aan béíde kanten van de baan.",
  "Het licht viel verkeerd. Net als de rest van m'n dag.",
  "M'n padel-app voorspelde winst. De app liegt dus.",
  "Ik hou de spanning erin voor m'n fans thuis.",
  "De baan lag scheef. Toevallig enkel voor mij.",
  "Ik speelde bewust slecht, anders wordt het te makkelijk voor de rest.",
  "Peptalk gemist, en meteen ook elke bal.",
  "Ik was aan het sparen. Voor m'n oude dag.",
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
