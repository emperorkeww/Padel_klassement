// Drempels, doelen en tabellen voor de prestatiebadges (badges.ts).

/** Rating-voorsprong die een tegenstanderteam tot "reus" maakt. */
export const REUZENDODER_DREMPEL = 50;

/** Puntenverschil vanaf wanneer een winst een "monsterzege" is. Bewust lager
 *  dan een volledige 6-0 (dat is al Broodje bal): 6-2 / 6-1 telt ook. */
export const MONSTERZEGE_DREMPEL = 4;

/** Verliesreeks die de (ludieke) Pechvogel-badge oplevert. */
export const PECHVOGEL_DREMPEL = 5;

/** Verliezen op rij waarna een winst als "comeback" telt. */
export const COMEBACK_DREMPEL = 3;

/** Aantal verschillende partners voor de Sociale vlinder. */
export const SOCIALE_VLINDER_DOEL = 5;

/** Matches met dezelfde partner voor de Trouwe ziel. */
export const TROUWE_ZIEL_DOEL = 10;

/** Aantal matches op één dag voor de Marathonspeler. */
export const MARATHON_DOEL = 3;

/** Verliezen op rij voor de (extreme) Zwarte reeks. */
export const ZWARTE_REEKS_DREMPEL = 10;

/** Matches met een vlekkeloze 100%-winst voor de Perfectionist. */
export const PERFECTIONIST_DOEL = 10;

/** Matches op één dag voor de (extreme) Ironman. */
export const IRONMAN_DOEL = 5;

/** Nachtmatches (na 22u) voor de Nachtwacht. */
export const NACHTWACHT_DOEL = 3;

/** Broodjes bal (6-0-winsten) voor de Bagelbakker. */
export const BAGELBAKKER_DOEL = 3;

/** Duels tegen hetzelfde team voor de Vaste rivaal. */
export const RIVAAL_DOEL = 10;

/** Winsten met exact één punt verschil voor de Fotofinish. */
export const FOTOFINISH_DOEL = 3;

/** Verschillende maanden (van het jaar) waarin je speelde voor de Kalenderslokker. */
export const KALENDER_DOEL = 12;

/** Minimum aantal matches voor de perfect gebalanceerde Yin-yang. */
export const YINYANG_DOEL = 10;

/** Eigen game-score vanaf wanneer een winst "dubbele cijfers" haalt. */
export const DUBBELE_CIJFERS_DREMPEL = 10;

/** Rating waaronder je de (ludieke) Diepzeeduiker wordt. */
export const DIEPZEE_DREMPEL = 900;

/** Dagen zonder match voordat je De verloren zoon bent. */
export const VERLOREN_ZOON_DAGEN = 60;

/** Dagen rust waarna een winst meteen "Roestvrij" oplevert. */
export const ROESTVRIJ_DAGEN = 30;

/** Afwisselende winst/verlies-uitslagen op rij voor de Jojo. */
export const JOJO_DOEL = 6;

/** Gelijke spelen voor Neutraal als Zwitserland. */
export const ZWITSERLAND_DOEL = 5;

/** Opeenvolgende matches met exact dezelfde eindscore voor Déjà vu. */
export const DEJAVU_DOEL = 3;

/** Winsten met exact hetzelfde puntenverschil voor de Sniper. */
export const SNIPER_DOEL = 5;

/** Totaal aantal zelf gepakte games voor de Puntenmachine. */
export const PUNTENMACHINE_DOEL = 500;

/** Winsten op rij met dezelfde partner voor Tweelingzielen. */
export const TWEELING_DOEL = 5;

/** Verliezen op rij tegen één team dat dat team je "angstgegner" maakt. */
export const ANGSTGEGNER_DREMPEL = 5;

/** Matches met exact dezelfde starttijd (uur + minuut) voor Klokvast. */
export const KLOKVAST_DOEL = 10;

/** Opeenvolgende kalenderweken met minstens één match voor het Weekritme. */
export const WEEKRITME_DOEL = 5;

/** Maximale minuten tussen twee matchstarts voor Back-to-back. */
export const BACK_TO_BACK_MINUTEN = 90;

export const WINSTEN: Array<{ doel: number; naam: string; emoji: string }> = [
  { doel: 25, naam: "Winnaarstype", emoji: "🏅" },
  { doel: 50, naam: "Halve eeuw zeges", emoji: "🏆" },
  { doel: 100, naam: "Honderd zeges", emoji: "🏛️" },
];

export const RATINGTIERS: Array<{ drempel: number; naam: string; emoji: string }> = [
  { drempel: 1100, naam: "Gevestigde waarde", emoji: "📈" },
  { drempel: 1200, naam: "Grootmeester", emoji: "🧠" },
  { drempel: 1300, naam: "Levende legende", emoji: "👑" },
];

/** Perfecte weken (alle weekmissies van die week gehaald, #118). */
export const PERFECTE_WEKEN: Array<{ doel: number; naam: string; emoji: string }> = [
  { doel: 1, naam: "Perfecte week", emoji: "🌠" },
  { doel: 10, naam: "Weekheld", emoji: "🦸" },
];

export const MIJLPALEN: Array<{ doel: number; naam: string; emoji: string }> = [
  { doel: 10, naam: "Vaste klant", emoji: "🏓" },
  { doel: 25, naam: "Veelspeler", emoji: "🎾" },
  { doel: 50, naam: "Halve honderd", emoji: "💪" },
  { doel: 100, naam: "Eeuwfeest", emoji: "💯" },
  { doel: 200, naam: "Baanbewoner", emoji: "🏠" },
  { doel: 365, naam: "Jaarganger", emoji: "📅" },
  { doel: 500, naam: "Halve legende", emoji: "🗿" },
  { doel: 1000, naam: "Onsterfelijk", emoji: "🐢" },
];

export const REEKSEN: Array<{ doel: number; naam: string; emoji: string }> = [
  { doel: 3, naam: "Hattrick", emoji: "⚡" },
  { doel: 5, naam: "On fire", emoji: "🔥" },
  { doel: 10, naam: "Onstuitbaar", emoji: "🚀" },
  { doel: 20, naam: "Onaanraakbaar", emoji: "🛡️" },
];
