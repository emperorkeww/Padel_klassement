// El Padelissimo — "De Troon" (#528, vervolg op #527): een gekwalificeerde
// dictator-#1 (tier `dictator`, rating 1600+) wordt van het klassement
// losgekoppeld en op een eigen troon gezet. Waar de Big Daddy (bigDaddy.ts) nog
// gewoon op het podium tussen het volk staat, deelt een dictator geen podium.
//
// Deze module levert de troon-copy: de over-the-top slogan op de troon (i.p.v.
// de neutrale Big Daddy-roast) plus de waarnemend-dictator-constanten (#530).
// Deterministisch per seed (de speler-key), zodat ze vast staan per dictator
// maar per persoon verschillen — geen geflikker, geen Math.random. Coach Rudy's
// kijker-gerichte reactie op de troon is z'n knieval (#531) en woont in
// roastTone.ts (`coachBuiging`), niet hier.

export const DICTATOR_EMOJI = "🫡";
/** Insigne op de troon i.p.v. een rangnummer — hij staat buiten de lijst. */
export const DICTATOR_INSIGNE = "№1 · Dictator";

// Propaganda-ondertitel op de troon: staatspropaganda i.p.v. spot.
const PROPAGANDA = [
  "regeert de baan als onbetwiste alleenheerser",
  "deelt geen podium — hij ís het podium",
  "bepaalt wie er speelt en wie z'n koffers pakt",
  "het volk speelt hooguit om plek twee",
  "onaantastbaar, onbetwist, ondraaglijk",
  "de kooi is nu een dictatuur en hij regeert",
  "eist de rol van sportief directeur en speler-voorzitter op",
  "veto't elke wissel en ontslaat de kantinebeheerder",
  "weert tegenstanders per direct uit de groepsapp",
  "verbiedt tegenstanders om z'n racket aan te raken",
] as const;

// Stabiele, kleine string-hash (djb2-variant) — zelfde idee als bigDaddy.ts,
// puur zodat dezelfde seed altijd dezelfde regel oplevert.
function hash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  return Math.abs(h);
}

/** Propaganda-ondertitel voor de troon; deterministisch per seed (speler-key). */
export function dictatorPropaganda(seed: string): string {
  return PROPAGANDA[hash(seed) % PROPAGANDA.length];
}

// Waarnemend dictator (#530): een dictatuur zónder dictator is een anticlimax,
// dus zolang geen enkele échte speler El Padelissimo (1600+) haalt, blijft de
// troon bezet — door Kylian Mbappé, de meme-dictator van de baan (#527). Hij
// regeert bij verstek en verdwijnt zodra een clublid kwalificeert (#528).
export const DEFAULT_DICTATOR = {
  name: "Kylian Mbappé",
  emoji: "🐐",
} as const;

// Uitschakelbaar (#536): niet iedereen wil een externe meme-figuur permanent
// bovenaan het klassement, en z'n portret-asset (~2 MB) hoeft dan ook de bundle
// niet in. De dictator-divisie zelf (#527) blijft altijd bestaan; alleen de
// waarnemend-default is optioneel. Default AAN — huidig gedrag ongewijzigd; zet
// `VITE_DEFAULT_DICTATOR=false` om 'm uit te zetten.

/** Staat de waarnemend dictator (Mbappé bij verstek) aan? Op runtime gelezen,
 *  zodat het in tests te stubben is; in de build vouwt Vite de env-waarde in. */
export function defaultDictatorEnabled(): boolean {
  return import.meta.env.VITE_DEFAULT_DICTATOR !== "false";
}

// Per-gebruiker toggle (#542): de waarnemend Mbappé is puur cosmetisch (de
// dictator-divisie #527 blijft altijd bestaan), dus elke gebruiker mag 'm zelf
// wegklikken — cross-device via de profiles-kolom `toon_waarnemend_dictator`
// (default true = zichtbaar). Gelezen uit het profiel (Leaderboard/instellingen),
// niet hier: deze module blijft IO-vrij.

/** Laadt het portret van de waarnemend dictator lui, achter de #536-vlag. Staat
 *  de flag uit, dan is de `import()` een dode tak (build-time constante) die
 *  Rollup wegsnoeit — de ~2 MB-asset belandt dan niet in de build. Geeft null
 *  wanneer de waarnemend dictator uit staat. */
export function laadWaarnemendPortret(): Promise<string | null> {
  if (import.meta.env.VITE_DEFAULT_DICTATOR === "false")
    return Promise.resolve(null);
  return import(
    "@/features/dictator/components/dictator-portret-groen-uniform.png"
  ).then((m) => m.default as string);
}

/** Waarnemend-label i.p.v. een ambtstermijn — het is geen echt clublid. */
export const DEFAULT_DICTATOR_LABEL = "Madrid-Dictator";

/** Korte slogan op de troon voor de waarnemend dictator (los van de echte roast). */
export const DEFAULT_DICTATOR_PROPAGANDA =
  "regeert vanuit Madrid en veto't elke opstelling";

// Regeerduur op het profiel (#545): wie ooit dictator was draagt dat als een
// blijvend erepalmpje/schandpaal — hoelang hij in totaal heerste en over hoeveel
// ambtstermijnen. Een afgezette dictator keert in het klassement terug als GOAT,
// maar deze troon-tijd blijft op zijn profiel staan.

/** Leesbare regeerduur, bv. "3 dagen", "5 uur" of "< 1 uur". */
export function regeerduurLabel(totaalMs: number): string {
  const uren = totaalMs / 3_600_000;
  if (uren < 1) return "< 1 uur";
  if (uren < 24) {
    const h = Math.floor(uren);
    return `${h} uur`;
  }
  const dagen = Math.floor(uren / 24);
  return `${dagen} ${dagen === 1 ? "dag" : "dagen"}`;
}

/** Volledige erepalmpje-zin voor het profiel, bv. "Regeert al 3 dagen als
 *  El Padelissimo" (zittend) of "Heerste in totaal 12 dagen · 2 ambtstermijnen"
 *  (afgezet). */
export function regeerduurZin(
  totaalMs: number,
  termijnen: number,
  zittend: boolean,
): string {
  const duur = regeerduurLabel(totaalMs);
  const kop = zittend
    ? `Regeert al ${duur} als El Padelissimo`
    : `Heerste in totaal ${duur}`;
  return termijnen > 1 ? `${kop} · ${termijnen} ambtstermijnen` : kop;
}
