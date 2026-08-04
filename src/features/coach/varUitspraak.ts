// Rudy's uitspraak bij een VAR-zaak (#1025). De procedure zit in de databank
// (resolve_point_appeal) en de bediening in het VAR-blok; hier staat wat Coach
// Rudy erover te zeggen heeft.
//
// Toon: plechtig gezag over beelden die niet bestaan. De uitspraak volgt de
// roast-regie van #183 — geseed op het beroep zelf, zodat de hele groep
// dezelfde zin ziet, en met een neutrale variant zodra de klager zijn
// roast-schild op heeft. Lof en spot zijn hier één en hetzelfde: ook een
// toegekende claim krijgt een sneer mee, want gelijk krijgen is in deze club
// geen reden tot bescheidenheid.
//
// Pure functies, getest in varUitspraak.test.ts.

import { kiesUniek, roastSeed, type CoachMood, type RoastCtx } from "./roastTone";

/** De uitkomsten waarover Rudy iets te zeggen heeft (status van point_appeals,
 *  zonder 'open' — een lopende zaak krijgt geen uitspraak). */
export type VarUitkomst =
  | "toegekend"
  | "afgewezen"
  | "verlopen"
  | "tegoed-op";

/** Toegekend, en de winnaar van de match blijft dezelfde. */
export const TOEGEKEND: readonly string[] = [
  "Na bestudering van de beelden die niet bestaan, vanuit een camerahoek die er niet was: het punt gaat naar de uitdagers.",
  "De VAR heeft gesproken. Het punt verhuist. De scheidsrechter van dienst zwijgt en gaat door.",
  "Toegekend. Ik heb niets gezien, maar ik heb het grondig niet gezien.",
  "Het punt is van jullie. Genoteerd, verwerkt, en over drie weken vergeten.",
  "Beroep gegrond. De geschiedenis is herschreven, zoals dat hoort met geschiedenis.",
  "Toegekend — en laat het gezegd zijn dat ik dat vanaf de eerste tel al vermoedde.",
  "De meerderheid heeft gesproken, en de meerderheid heeft toevallig gelijk. Punt toegewezen.",
  "Gegrond. Eén punt terug, en een reputatie die er nét iets beter uitziet.",
];

/** Toegekend, en daarmee draait de winnaar van de match om. Nooit stilletjes. */
export const TOEGEKEND_OMDRAAI: readonly string[] = [
  "Toegekend — en daarmee kantelt de hele wedstrijd. De winnaars van daarnet zijn de verliezers van nu.",
  "Eén punt, en de uitslag draait om. Ik zei het al: padel is een spel van marges en van mensen die niet kunnen tellen.",
  "Beroep gegrond, winnaar gewisseld. Iemand mag zijn overwinningsspeech gaan intrekken.",
  "De VAR keert de uitslag. Vier mensen kijken elkaar aan, drie van hen zwijgen ongemakkelijk.",
  "Toegekend, en de winst verhuist mee. Dit is precies waarom ik nooit slaap.",
];

/** Toegekend, maar de winnaar bleef dezelfde — dus aan het klassement
 *  verandert niets. Dat moet er eerlijk bij. */
export const TOEGEKEND_ZONDER_GEVOLG: readonly string[] = [
  "Toegekend. De uitslag schuift een puntje op, het klassement haalt zijn schouders op. Genoteerd voor de eer.",
  "Gegrond — en volstrekt zonder gevolgen. Je had gelijk, je verloor alsnog. Gefeliciteerd.",
  "Het punt is van jullie. De rating merkt er niets van. Zo werkt eer nu eenmaal.",
  "Toegekend. Eén cijfer verandert, verder niets. Het was je dat waard, en dat siert je.",
];

/** Afgewezen: gelijkspel, meerderheid tegen, of niemand die reageerde. */
export const AFGEWEZEN: readonly string[] = [
  "Beroep afgewezen. De beelden die niet bestaan bevestigen de oorspronkelijke beslissing.",
  "Afgewezen. De groep heeft gesproken, en de groep vond het niks.",
  "Verworpen. Ik heb het dossier gelezen, twee keer zelfs, en het bleef even dun.",
  "Afgewezen. De uitslag blijft staan, en jij blijft staan waar je stond.",
  "Geen meerderheid, geen punt. Volgende keer overtuigender roepen.",
  "Het beroep sneuvelt. Zo zie je maar: gelijk hebben en gelijk krijgen zijn twee sporten.",
  "Afgewezen — en de stemming was, laten we zeggen, niet spannend.",
  "Verworpen. De stilte van je medespelers sprak boekdelen.",
];

/** De uitslag was intussen al langs een andere weg gewijzigd. */
export const VERLOPEN: readonly string[] = [
  "Zaak vervallen: de uitslag waar dit beroep over ging bestaat niet meer. Je betwist een wedstrijd die er niet meer is.",
  "Ingetrokken door de omstandigheden. Iemand corrigeerde de uitslag terwijl jij aan het pleiten was.",
  "Vervallen. De stand is intussen veranderd, en ik ga geen correctie op een correctie stapelen.",
];

/** De groep gaf gelijk, maar het beroepstegoed van die speeldag was op. */
export const TEGOED_OP: readonly string[] = [
  "De groep gaf je gelijk. Je VAR was op. Eén toekenning per speeldag — dat is geen detail, dat is de regel.",
  "Gelijk gekregen, niets gewonnen: je had je beroep vanavond al verzilverd. De uitslag blijft staan.",
  "Gegrond, maar ongebruikt. Je tegoed was vergeven. Volgende keer beter kiezen wanneer je begint te roepen.",
];

/** De feitelijke, ongekleurde variant — voor wie zijn roast-schild op heeft.
 *  Plagen, geen kwetsen: wie niet mee wil hoeft niet (#183). */
export const NEUTRAAL: Record<VarUitkomst, string> = {
  toegekend: "Het beroep is toegekend: het punt is verschoven.",
  afgewezen: "Het beroep is afgewezen: de uitslag blijft staan.",
  verlopen:
    "Het beroep is vervallen: de uitslag was intussen al gewijzigd.",
  "tegoed-op":
    "De groep ging akkoord, maar het beroepstegoed van die speeldag was al gebruikt; de uitslag blijft staan.",
};

export interface VarUitspraakInput {
  /** Id van het beroep — de seed, zodat iedereen dezelfde zin leest. */
  appealId: string;
  status: VarUitkomst;
  /** Draait de toekenning de winnaar van de match om? */
  winnaarDraaitOm?: boolean;
  /** Toon van de groep + het schild van de klager. */
  ctx: RoastCtx;
  /** Al gebruikte zinnen in deze weergave; voorkomt herhaling in de feed. */
  gebruikt?: Set<string>;
}

/** Welke pool hoort bij deze uitkomst? Apart zodat de test hem kan aflopen. */
export function varPool(
  status: VarUitkomst,
  winnaarDraaitOm: boolean,
): readonly string[] {
  if (status !== "toegekend") {
    return status === "afgewezen"
      ? AFGEWEZEN
      : status === "verlopen"
        ? VERLOPEN
        : TEGOED_OP;
  }
  // De Elo-kern kijkt alleen naar de winnaar en niet naar de marge: blijft die
  // dezelfde, dan verandert er aan het klassement niets, en dat zegt Rudy er
  // eerlijk bij in plaats van een overwinning te suggereren.
  return winnaarDraaitOm ? TOEGEKEND_OMDRAAI : TOEGEKEND_ZONDER_GEVOLG;
}

/**
 * Rudy's uitspraak bij één afgehandelde zaak. Deterministisch op het beroep,
 * dus stabiel over herladen en gelijk voor de hele groep.
 */
export function varUitspraak(input: VarUitspraakInput): string {
  if (input.ctx.schild) return NEUTRAAL[input.status];
  const seed = roastSeed("var", input.appealId, input.status);
  // Weet de aanroeper niet of de winnaar omdraaide (bv. omdat de match niet
  // meegeladen is), dan de algemene toekenningspool: die belooft niets over
  // gevolgen die we niet kunnen nagaan.
  const pool =
    input.status === "toegekend" && input.winnaarDraaitOm === undefined
      ? TOEGEKEND
      : varPool(input.status, !!input.winnaarDraaitOm);
  return kiesUniek(pool, seed, input.gebruikt);
}

/** De gezichtsuitdrukking bij de uitspraak (CoachAvatar). Trots als hij iemand
 *  gelijk geeft, zijn eigen intensiteit als hij iemand afserveert. */
export function varMood(status: VarUitkomst, ctx: RoastCtx): CoachMood {
  if (ctx.schild) return "portret";
  if (status === "toegekend") return "trots";
  if (status === "afgewezen") return ctx.intensiteit;
  return "portret";
}
