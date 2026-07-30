// Layoutconfiguratie van de divisiekaart "Sletje van de baan" (#834).
//
// Deze kaart draagt niet de generieke FUT-stapel (eloblok, avatar, naamplaat,
// divisieregel) maar de compositie van docs/referentie_sletje_van_de_baan.png:
// een verweerd plaquette met de rating linksboven, een kleine profielfoto
// rechtsboven, de divisietitel halverwege en daaronder zes negatieve
// statistieken.
//
// Alle geometrie staat hier als fractie van de kaartbox. De getallen zijn
// meetresultaten: de kaartbox van de referentie is x 103..921, y 111..1248 —
// precies 818 × 1137 pixels, en dat is exact de 100 : 139 van de app. De
// afbeelding van referentie naar kaart is dus een zuivere verschuiving met
// schaal ~1, en elke gemeten pixel deelt zich direct om naar een fractie.

import type {
  DivisieKaartLayout,
  KaartStat,
  SpelerStatBron,
} from "../layouts/kaartLayout";
import "./SlofKaart.css";

import buiten from "./assets/slof-buiten.webp";
import omlijsting from "./assets/slof-omlijsting.webp";
import plaat from "./assets/slof-plaat.webp";

/* --------------------------------- statblok -------------------------------- */

/** Aandeel → tekortscore. De onderste divisie draagt in de referentie zes
 *  negatieve waarden; die worden hier uit de échte cijfers gerekend in plaats
 *  van overgeschreven. Een aandeel van 1 (alles goed) levert −1, een aandeel van
 *  0 levert −100. Zo blijft de grap staan én blijft de waarde data. */
function tekort(aandeel: number | null): string {
  if (aandeel == null || !Number.isFinite(aandeel)) return "—";
  const begrensd = Math.min(1, Math.max(0, aandeel));
  return `-${Math.max(1, Math.round(100 * (1 - begrensd)))}`;
}

const deel = (teller: number, noemer: number) =>
  noemer > 0 ? teller / noemer : null;

/** Het aandeel W in de recente vorm. */
function vormAandeel(bron: SpelerStatBron): number | null {
  const vorm = bron.vorm ?? [];
  if (vorm.length === 0) return null;
  return vorm.filter((uitslag) => uitslag === "W").length / vorm.length;
}

/** De langste aaneengesloten verliesreeks in de recente vorm. */
function verliesreeks(bron: SpelerStatBron): number {
  let langste = 0;
  let nu = 0;
  for (const uitslag of bron.vorm ?? []) {
    nu = uitslag === "L" ? nu + 1 : 0;
    if (nu > langste) langste = nu;
  }
  return langste;
}

/** Wikkelt een regel zodat een ontbrekende bron een streepje geeft in plaats
 *  van een verzonnen getal. */
const regel = (
  label: string,
  uit: (bron: SpelerStatBron) => number | null,
): KaartStat => ({
  label,
  waarde: (bron) => (bron ? tekort(uit(bron)) : "—"),
});

/** De zes regels van de referentie. De labels zijn vast — ze horen bij deze
 *  kaart zoals de tiernaam erbij hoort — maar élke waarde komt uit de cijfers
 *  die de ranglijstrij al draagt.
 *
 *  Wil je in plaats van deze afgeleide attributen de kale ranglijstcijfers
 *  tonen, dan is dit de enige plek die verandert. */
export const SLOF_STATS: readonly KaartStat[] = [
  regel("Winnaarsinstinct", (b) => deel(b.gewonnen, b.gespeeld)),
  regel("Rally's gehaald", (b) => deel(b.gewonnen + b.gelijk, b.gespeeld)),
  regel("Concentratie", vormAandeel),
  // Doelsaldo per wedstrijd, genormaliseerd op ±6 games: dat is de bandbreedte
  // waarin een padelavond zich in de praktijk afspeelt.
  regel("Verdedigen", (b) => {
    const perWedstrijd = deel(b.doelsaldo, b.gespeeld);
    return perWedstrijd == null ? null : (perWedstrijd + 6) / 12;
  }),
  // Punten per wedstrijd tegen de drie van een volle winst.
  regel("Smash kracht", (b) => {
    const perWedstrijd = deel(b.punten, b.gespeeld);
    return perWedstrijd == null ? null : perWedstrijd / 3;
  }),
  regel("Mentaliteit", (b) =>
    (b.vorm ?? []).length === 0
      ? null
      : 1 - verliesreeks(b) / (b.vorm ?? []).length,
  ),
];

/* --------------------------------- de layout ------------------------------- */

export const SLOF_LAYOUT: DivisieKaartLayout = {
  id: "slof",
  tier: "slof",
  className: "slof",

  // Het artwork brengt zijn eigen contour mee: de alfa van de omlijsting ís de
  // kaartvorm, silhouet en al uit de referentie gesneden. De generieke schil
  // (frame, liner, keyline, vlak) gaat daarom uit — anders tekent die een tweede
  // rand en een lichter kaartvlak onder een artwork dat zijn eigen contour en
  // licht al heeft.
  eigenSilhouet: true,

  zones: {
    // Exact de plekken van de referentie: de plaat ís haar perkament, dus de
    // inkt hoort te landen waar de inkt van de referentie stond. "350" beslaat
    // daar x 185..470 en y 205..345 van de kaartbox 818 × 1137. Rating,
    // subniveau en emoji delen één as (0,275).
    rating: { x: 0.085, y: 0.083, breedte: 0.38, hoogte: 0.125 },
    subniveau: { x: 0.085, y: 0.2146, breedte: 0.38, hoogte: 0.052 },
    emoji: { x: 0.085, y: 0.274, breedte: 0.38, hoogte: 0.07 },

    // Gecentreerd op het middelpunt van de stenen ring (682, 345 in de
    // referentie) en een fractie rúimer dan het gat erin. Die overmaat is nodig:
    // tussen het gat en de ring ligt de band waar de foto van de referentie is
    // weggehaald, en die vult zich met de donkere tint van de ring ernaast. Een
    // foto die precies op het gat past laat daar een donkere sikkel zien.
    portret: { x: 0.5205, y: 0.071, breedte: 0.375, hoogte: 0.2698 },

    // De naam staat op deze kaart niet in beeld — de referentie zet daar het
    // statblok. De zone blijft bestaan zodat hij in de accessibility tree valt;
    // SlofKaart.css maakt hem visueel verborgen.
    naam: { x: 0, y: 0, breedte: 0, hoogte: 0 },

    titel: { x: 0.1064, y: 0.4257, breedte: 0.792, hoogte: 0.055 },
    statistieken: { x: 0.1125, y: 0.496, breedte: 0.7787, hoogte: 0.299 },
  },

  statistieken: SLOF_STATS,

  // Drie samenhangende delen, letterlijk uit de referentie gesneden en op hun
  // eigen plek gelaten: hun onderlinge ligging is die van het bronbeeld, dus
  // lijst, crests, spinrag en het stilleven onderin grijpen met hun eigen
  // schaduwen in elkaar. De maten komen uit assets/slof-onderdelen.json.
  onderdelen: [
    // Spinrag om de bovenhoeken, ducttape op de rechterflank en losgeraakt
    // afval. Achter de kaart, zodat het rag zichtbaar om de lijst heen loopt.
    {
      id: "buiten",
      src: buiten,
      laag: "randAchter",
      slot: "achter",
      x: -0.09658,
      y: -0.09763,
      breedte: 1.18949,
      hoogte: 1.10114,
    },
    // Het perkament binnen de lijst, mét al zijn scheuren en vlekken én het
    // complete stilleven onderin (racket, fles, sok, papier, gruis). In het
    // kaartvlak gemonteerd, dus ónder de inkt.
    {
      id: "plaat",
      src: plaat,
      laag: "vuil",
      slot: "binnen",
      x: 0.06601,
      y: 0.00176,
      breedte: 0.8802,
      hoogte: 0.94107,
    },
    // De volledige metalen lijst met beide crests en de boog, in één stuk.
    {
      id: "omlijsting",
      src: omlijsting,
      laag: "randVoor",
      slot: "voor",
      x: -0.05501,
      y: -0.05365,
      breedte: 1.11491,
      hoogte: 1.06332,
    },
  ],
};

export default SLOF_LAYOUT;
