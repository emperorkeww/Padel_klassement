// Gedeelde roast-bouwstenen voor de Edge Functions. Edge functions delen geen
// code met src/, dus dit is een eigen compacte set die de toon-conventies van
// src/features/coach/ spiegelt (plagend over padel en ego, nooit persoonlijk of
// grof). Sinds #409 staan hier twee tekstsets: de pias-sneer (#203) en de
// afdroging-teksten (bagel/monsterzege), plus de gedeelde seed-helpers.

export type RoastIntensiteit = "mild" | "gemeen" | "radioactief";

// Stabiele djb2-hash + deterministische keuze, gekopieerd uit
// src/features/coach/roastTone.ts (roastSeed/seedIndex) zodat een
// webhook-retry dezelfde tekst oplevert.
export function roastSeed(...delen: string[]): number {
  let h = 5381;
  const s = delen.join("|");
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function kiesUit(pool: readonly string[], seed: number): string {
  return pool[((seed % pool.length) + pool.length) % pool.length];
}

/** Puntenverschil vanaf wanneer een winst een "monsterzege" is — gelijk aan
 *  MONSTERZEGE_DREMPEL in src/features/profiles/badges.constants.ts (#409), zodat
 *  push en feed dezelfde afdroging "monsterzege" noemen. */
export const MONSTERZEGE_DREMPEL = 4;

/** De afdroging-soort van een uitslag, of null bij een gewone score. Spiegelt
 *  scoreHighlight() in src/features/feed/feedLogic.ts: bagel (6-0) is het
 *  sterkste verhaal, dan monsterzege (verschil ≥ MONSTERZEGE_DREMPEL). */
export function afdrogingLabel(
  m: { score_a: number | null; score_b: number | null },
): "bagel" | "monsterzege" | null {
  if (m.score_a == null || m.score_b == null) return null;
  const hi = Math.max(m.score_a, m.score_b);
  const lo = Math.min(m.score_a, m.score_b);
  if (lo === 0 && hi > 0) return "bagel";
  if (hi - lo >= MONSTERZEGE_DREMPEL) return "monsterzege";
  return null;
}

// Pias-sneren voor de push (#203), bewust kort genoeg voor een notificatie.
export const PIAS_SNEER: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Grote favoriet, klein resultaat. Gebeurt de besten. Jou net iets vaker.",
    "De statistieken geloofden in je. De bal duidelijk niet.",
    "Iedereen mag eens verliezen. Alleen deed jij het als torenhoge favoriet.",
    "Kop op: volgende week is er een nieuwe pias. Al ben jij nu wel favoriet.",
    "Je was dé favoriet. Wás. Verleden tijd, net als je vormpeil.",
    "Padel is een teamsport, maar deze titel heb je helemaal zelf verdiend.",
  ],
  gemeen: [
    "De favoriet van de week werd de pias van de week. Poëzie, eigenlijk.",
    "Jij had de hoogste rating op de baan. De baan had daar geen boodschap aan.",
    "Winnen was het minimum. Jij ging vol voor het maximum aan schaamte.",
    "De underdogs danken je hartelijk. Hun hele week is goedgemaakt.",
    "Ik heb je winkans nagerekend. De wiskunde klopte, jij niet.",
    "Zelfs de glazen wand speelde beter mee dan jij.",
  ],
  radioactief: [
    "Dit zet ik in de groepschat. Voor de eeuwigheid.",
    "Zo'n winkans verprutsen hoort in een museum. Vitrine, spotje erop.",
    "De bookmakers zijn failliet aan jou. Je team ook, mentaal.",
    "Choke van de week? Choke van het seizoen, als je het mij vraagt.",
    "Je rating schreef een cheque die je armen niet konden innen.",
    "Ik heb het teruggekeken. Twee keer. Het werd niet beter.",
  ],
};

// Sneer voor een verliezer van een droge 6-0 (#409). Zelfdragend: de tekst
// benoemt de bagel zelf, zoals de BAGEL-pool in coachFeed.ts.
export const BAGEL_SNEER: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Een droge 6-0. Gebeurt de besten — vandaag toevallig jou.",
    "Nul games. Kop op, morgen staat er weer een baan klaar.",
    "6-0 tegen. De cijfers zijn hard; jij was het even niet.",
    "Broodje bal geserveerd gekregen. Volgende keer beter.",
  ],
  gemeen: [
    "Een droge 6-0. Hebben jullie de rackets eigenlijk uit de tas gehaald?",
    "Nul games. Zelfs het scorebord keek beschaamd de andere kant op.",
    "6-0. Dat is geen wedstrijd, dat is een openbare terechtstelling.",
    "Fietsbandjes uitgedeeld gekregen. Tijd voor stevige zelfreflectie.",
  ],
  radioactief: [
    "Een droge 6-0. Dit zet ik in de groepschat. Voor de eeuwigheid.",
    "Nul games. Ik heb 'm teruggekeken. Twee keer. Het werd niet beter.",
    "6-0. De glazen wanden trillen nog na van deze vernedering.",
    "Zo'n afgang hoort in een museum. Vitrine, spotje erop.",
  ],
};

// Sneer voor een verliezer van een monsterzege (verschil ≥ drempel, geen 6-0).
export const MONSTER_SNEER: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Meedogenloos afgemaakt. Baal even, en dan door.",
    "Flink pak slaag gehad. Volgende keer bijt je terug.",
    "Compleet overklast vandaag. Gebeurt de besten.",
    "Dat was geen partij, dat was een statement. Van de overkant.",
  ],
  gemeen: [
    "Weggespeeld zonder pardon. Ze wisten niet eens waar je stond.",
    "Een pak slaag om in te lijsten. Voor hén, niet voor jou.",
    "Genadeloos ingemaakt. De coach knikt goedkeurend — naar de overkant.",
    "Vleesmolen-padel. Geen spaan heel gelaten van jullie.",
  ],
  radioactief: [
    "Een slachting. Ik noteer 'm met sadistisch genoegen.",
    "Dat was geen wedstrijd, dat was een openbare executie.",
    "Volledig van de baan geveegd. Dit niveau van overmacht is bijna wreed.",
    "Afgedroogd tot op het bot. Dit bespreken we nog jaren na.",
  ],
};

// Schouderklopje voor de winnaars van een afdroging (#409). Geen persoonlijke
// sneer maar commentaar op de zege, dus niet intensiteit-geschaald en niet door
// het roast-schild beperkt — net als de hype-pools in coachFeed.ts.
export const AFDROGING_LOF: readonly string[] = [
  "Meedogenloos afgemaakt. Prachtig wreed — zo hoort dat.",
  "Geen spaan heel gelaten. De coach knikt goedkeurend.",
  "Dat was geen partij, dat was een statement. Chapeau.",
  "Weggespeeld zonder pardon. Dominantie met hoofdletters.",
  "Een pak slaag om in te lijsten. Genieten was het.",
  "De sloophamer erin. Effectief en genadeloos. Mooi.",
  "Absolute klasse. De tegenstander mocht enkel toekijken.",
  "Zo domineer je een baan. M'n notitieboekje krijgt een gouden randje.",
];
