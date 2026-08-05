// Een tijdelijk wachtwoord dat je door de telefoon kunt voorlezen (#1036).
//
// Drie Nederlandse woorden en een cijfer. Dat is de hele eis: het moet te
// dicteren zijn aan iemand die naast een baan staat, zonder "hoofdletter-i of
// kleine L?". Vandaar geen leestekens, geen hoofdletters en woorden die in het
// Nederlands maar op één manier te spellen zijn.
//
// Sterkte: 3 verschillende woorden uit 60 + een cijfer ≈ 21 bits. Bewust weinig voor
// een permanent wachtwoord en ruim genoeg voor dit doel — het is eenmalig, de
// gebruiker moet het bij de eerstvolgende login vervangen (de trigger
// on_auth_password_changed vinkt dat af), en het wordt nergens opgeslagen.
//
// Puur, met een injecteerbare randombron zodat het te unit-testen is.

// Korte, ondubbelzinnige woorden. Geen c/k-, ei/ij- of au/ou-verwarring, en
// niets dat als beledigend kan landen wanneer je het iemand voorleest.
const WOORDEN = [
  "appel", "anker", "bal", "beker", "berg", "bloem", "boek", "boom",
  "brood", "brug", "deur", "doel", "duim", "fiets", "gras", "haven",
  "hond", "hoed", "kaas", "kabel", "kamer", "kist", "klok", "koffie",
  "kroon", "lamp", "lepel", "maan", "molen", "muur", "nacht", "net",
  "olie", "oven", "pen", "poort", "raam", "regen", "ring", "rots",
  "schoen", "sleutel", "sneeuw", "spiegel", "stoel", "storm", "strand",
  "tafel", "toren", "tuin", "vlag", "vogel", "vuur", "water", "wolk",
  "zand", "zeil", "zomer", "zon", "zout",
] as const;

/** Randombron: geeft een geheel getal in [0, max). */
export type Random = (max: number) => number;

/** Standaardbron: crypto.getRandomValues, zonder modulo-scheefheid. */
export const cryptoRandom: Random = (max) => {
  const grens = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= grens);
  return n % max;
};

/**
 * Bouwt een wachtwoord als `woord-woord-woord7`. De drie woorden zijn
 * onderling verschillend: een herhaling ("bal-bal-boom") leest als een fout en
 * kost bovendien entropie.
 *
 * Trekken zonder teruglegging (splice) en niet met een "opnieuw als het al
 * gekozen is"-lus: die lus loopt voor eeuwig door zodra de randombron een vaste
 * waarde teruggeeft. Dat is geen theoretisch geval — het is precies wat een
 * test met een deterministische bron doet.
 */
export function genereerWachtwoord(random: Random = cryptoRandom): string {
  const voorraad = [...WOORDEN];
  const gekozen: string[] = [];
  for (let i = 0; i < 3; i++) {
    const [woord] = voorraad.splice(random(voorraad.length), 1);
    gekozen.push(woord);
  }
  return `${gekozen.join("-")}${random(10)}`;
}

/** Alleen voor de test: het aantal woorden bepaalt de sterkte-uitspraak boven. */
export const WOORDENLIJST_LENGTE = WOORDEN.length;
