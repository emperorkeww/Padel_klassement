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

// ── Anticipatie-pushes in Rudy's stem (#302) ────────────────────────────────
// Nieuwe-ronde en "jouw beurt" zijn géén straf maar een vooruitblik: schild aan
// (of onbekend profiel) → een warme, neutrale regel, anders een op intensiteit
// geschaalde plaag. Bewust notificatie-kort, zoals de PIAS/BAGEL-pools.

// Nieuwe ronde gegenereerd — de match staat klaar (send-push, new_round).
export const NIEUWE_MATCH_NEUTRAAL: readonly string[] = [
  "Er staat een nieuwe match voor je klaar. Veel plezier op de baan.",
  "Nieuwe ronde gegenereerd — kijk maar eens tegen wie je speelt.",
  "Je volgende match staat ingepland. Succes ermee.",
];
export const NIEUWE_MATCH: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Nieuwe ronde. Warm die smoesjes alvast op.",
    "Er staat een match klaar. Probeer deze keer wél te winnen.",
    "Je volgende tegenstander is bekend. Slaap er maar een nachtje minder om.",
    "Nieuwe match gegenereerd. Mijn notitieboekje ligt weer open.",
  ],
  gemeen: [
    "Nieuwe ronde. Je tegenstander slaapt nog — verrassingsaanval?",
    "Er staat een match klaar. Ik heb de EHBO alvast stand-by gezet.",
    "Nieuwe match. Deze keer graag de bal wél over het net, als experiment.",
    "Je volgende partij is ingepland. Mijn tactische plan: hoop op geluk.",
  ],
  radioactief: [
    "Nieuwe ronde. Verlies deze en ik lees het voor op de persconferentie.",
    "Er staat een match klaar. Begin vast met een creatief excuus verzinnen.",
    "Nieuwe match. Ik heb m'n rode pen al geslepen voor het notitieboekje.",
    "Je volgende tegenstander is bekend. Zij ook — en zij lachen.",
  ],
};

// "Jouw beurt": vlak vóór een geplande match (match-reminders). De regels volgen
// op "Om <tijd> sta je op de baan.", dus ze staan op zichzelf zonder tijd.
export const JOUW_BEURT_NEUTRAAL: readonly string[] = [
  "Succes met je match!",
  "Zet 'm op vandaag.",
  "Veel plezier op de baan.",
];
export const JOUW_BEURT: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Vergeet je racket niet, en je smoesjes ook niet.",
    "Warmloopschoenen aan — het is bijna tijd.",
    "Tijd om te laten zien dat je getraind hebt. Toch?",
    "Nog even en de bal rolt. Focus.",
  ],
  gemeen: [
    "Probeer deze keer op te komen dagen én te scoren.",
    "Ik hou m'n notitieboekje bij de hand. Voor de zekerheid.",
    "Je tegenstander is al aan het rekken. Jij nog aan het twijfelen?",
    "Tijd om te bewijzen dat het geen typefout in het klassement was.",
  ],
  radioactief: [
    "Verlies je deze, dan hoort de hele groepschat het van me.",
    "Laatste kans om m'n tactische plan niet volledig te verpesten.",
    "De persconferentie na afloop schrijf ik nu al. Kies zelf de toon.",
    "Kom opdagen. Of niet — dan win ik de weddenschap met mezelf.",
  ],
};

// Relationele/planning-pushes (#302): een vriendschapsverzoek en de speeldag-
// polls zijn niet-kwetsend en gaan vaak naar meerdere ontvangers, dus één warme,
// licht plagende pool — schild-neutraal per definitie, niet intensiteit-geschaald
// (zoals AFDROGING_LOF). Ze volgen op een informatieve eerste zin.
export const VRIENDSCHAP: readonly string[] = [
  "Vers bloed voor je vijandenlijst. Ik noteer 'm.",
  "Een nieuwe rivaal in de maak. Accepteer maar, dan kun je verliezen.",
  "Nog een naam om straks van te winnen. Of andersom.",
  "Tijd om die vriendschap op de baan te testen.",
  "Ik verheug me nu al op jullie eerste onderlinge bloedbad.",
];
export const POLL_NIEUW: readonly string[] = [
  "Stem wanneer je kunt — mijn wisselschema hangt ervan af.",
  "Laat weten wanneer je kan, dan plan ik de vernedering in.",
  "Geef je momenten door voordat de groep zonder jou beslist.",
  "Stemmen is verplicht. Nou ja, sterk aangeraden.",
];
export const POLL_MOMENT: readonly string[] = [
  "Zet 'm in je agenda, geen smoesjes achteraf.",
  "Kom opdagen, of leg het straks maar uit aan mij.",
  "De baan roept. Jij hopelijk ook.",
];
export const POLL_GEBOEKT: readonly string[] = [
  "Baan geboekt. Nu jij nog, in vorm.",
  "Het is officieel. Poets die rackets op.",
  "Geregeld. Ik verwacht een waardig schouwspel.",
];

// ── Promotie / degradatie in het groepsklassement (#302) ────────────────────
// Een tier-overgang (troon / top-3 / kelder) is promotie of degradatie. De
// tiers zijn geordend kelder < middenmoot < jager < troon; 'nieuw' doet niet
// mee (in-/uitstappen op de ladder is geen promotie). rangOvergang() vertaalt
// een (oud → nieuw)-tierpaar naar een gebeurtenis + richting.

export type RangRichting = "promotie" | "degradatie";
export type PromotieEvent = "troon" | "top3" | "uit_kelder";
export type DegradatieEvent = "troon_kwijt" | "kelder" | "uit_top3";
export type RangOvergang =
  | { richting: "promotie"; event: PromotieEvent }
  | { richting: "degradatie"; event: DegradatieEvent };

/** Classificeert een tier-overgang. null als één van beide 'nieuw' is of de
 *  tier niet wijzigt (dan is er niets te melden). Volgorde van de checks bepaalt
 *  de "sterkste" duiding: troon vóór top-3, kelder vóór de rest. */
export function rangOvergang(
  oud: string,
  nieuw: string,
): RangOvergang | null {
  if (oud === nieuw || oud === "nieuw" || nieuw === "nieuw") return null;
  if (nieuw === "troon") return { richting: "promotie", event: "troon" };
  if (oud === "troon") return { richting: "degradatie", event: "troon_kwijt" };
  if (nieuw === "kelder") return { richting: "degradatie", event: "kelder" };
  if (nieuw === "jager") return { richting: "promotie", event: "top3" };
  if (oud === "jager") return { richting: "degradatie", event: "uit_top3" };
  if (oud === "kelder") return { richting: "promotie", event: "uit_kelder" };
  return null;
}

// Promotie is positief, geen straf: één schild-neutrale pool per gebeurtenis,
// niet intensiteit-geschaald (zoals AFDROGING_LOF). Het roast-schild dempt de
// felicitatie niet — wie geen meldingen wil, zet notify_rank_change uit.
export const RANK_PROMOTIE: Record<PromotieEvent, readonly string[]> = {
  troon: [
    "Je bent de nieuwe nummer één. De troon is van jou — voorlopig.",
    "Bovenaan het klassement! Zelfs ik begin te geloven dat je kunt padellen.",
    "De koppositie is binnen. Geniet ervan, de haaien ruiken al bloed.",
    "Nummer één. M'n notitieboekje krijgt vandaag een gouden randje.",
  ],
  top3: [
    "Welkom in de top-3. De troon staat nu binnen handbereik.",
    "Je bent de top-3 binnengedrongen. De koploper voelt je hijgen in z'n nek.",
    "Top-3! Nog een paar zeges en we bestormen de eerste plek.",
    "De subtop is van jou. Ik heb de aanvalsplannen al klaarliggen.",
  ],
  uit_kelder: [
    "Uit de kelder geklommen. De rode lantaarn geef je met plezier door.",
    "Je bent de kelder ontsnapt. Zie je wel dat je er niet thuishoorde.",
    "Weg uit de onderste regionen. De weg omhoog is ingezet.",
    "De kelderklasse achter je gelaten. Netjes — nu doorpakken.",
  ],
};

// Degradatie is een sneer: intensiteit-geschaald, schild aan → een neutrale,
// feitelijke regel (net als de afdroging-verliezers, #409).
export const RANK_DEGRADATIE_NEUTRAAL: Record<DegradatieEvent, readonly string[]> = {
  troon_kwijt: [
    "Je bent de koppositie kwijt. Het gebeurt de besten.",
    "De troon is overgenomen. Tijd om terug te klimmen.",
  ],
  uit_top3: [
    "Je bent uit de top-3 gezakt. Werk aan de winkel.",
    "Net buiten de top-3 nu. De weg terug ligt open.",
  ],
  kelder: [
    "Je bent in de kelder van het klassement beland. Kop op.",
    "Onderin de stand nu. De enige weg is omhoog.",
  ],
};
export const RANK_DEGRADATIE: Record<
  DegradatieEvent,
  Record<RoastIntensiteit, readonly string[]>
> = {
  troon_kwijt: {
    mild: [
      "De troon ben je kwijt. Aan de top is het glad, zei ik toch.",
      "Niet langer nummer één. Genoten van het uitzicht?",
      "Je koppositie is ingenomen. Even bijkomen, dan terugvechten.",
    ],
    gemeen: [
      "De troon is bezet — en niet meer door jou. Pijnlijk, hè?",
      "Van nummer één naar de achtervolgers. De haaien hadden gelijk.",
      "Je bent onttroond. M'n notitieboekje noteert het met een zucht.",
    ],
    radioactief: [
      "Onttroond. Ik zet 'm in de groepschat, voor de eeuwigheid.",
      "De koning is dood. Lang leve wie je net voorbijstak.",
      "Van de troon gekieperd. Zo hoog geklommen om zó te vallen.",
    ],
  },
  uit_top3: {
    mild: [
      "Uit de top-3 gegleden. Gebeurt de besten, ook jou.",
      "Net buiten de subtop nu. Terugknokken maar.",
      "De top-3 liet je los. Tijd voor een tactische ommekeer.",
    ],
    gemeen: [
      "Uit de top-3 gevallen. De jagers werden zelf opgejaagd.",
      "Weg uit de subtop. Ik had m'n pet al schuin gezet, voor niets.",
      "De top-3 spuugt je uit. Dat vraagt om zelfreflectie.",
    ],
    radioactief: [
      "Uit de top-3 geknikkerd. Van jager naar prooi in één match.",
      "De subtop is je ontglipt. Ik heb er een boos krabbeltje over gemaakt.",
      "Weg uit de top-3. Zo snel gezakt dat de statistieken duizelig werden.",
    ],
  },
  kelder: {
    mild: [
      "Afgezakt naar de kelder. De enige weg is nu omhoog.",
      "In de onderste regionen beland. Kop op, comebacks bestaan.",
      "De kelder in. Niks dat een paar zeges niet oplossen.",
    ],
    gemeen: [
      "Welkom in de kelder. De rode lantaarn staat je verrassend goed.",
      "Afgezakt naar de onderkant. Zelfs de watersproeiers kijken meewarig.",
      "De kelder in gezakt. Ik zet alvast koffie voor de lange klim terug.",
    ],
    radioactief: [
      "De kelder in gedonderd. Dit hoort in een museum — vitrine, spotje erop.",
      "Hekkensluiter nu. Ik heb m'n viool gestemd, hij speelt zachtjes voor je.",
      "Vrije val naar de bodem. Ik noteer 'm met sadistisch genoegen.",
    ],
  },
};
