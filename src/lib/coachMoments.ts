// Coach Rudy op méér dan de feed (#213): pure, deterministische generators voor
// het dashboard-ochtendpraatje, de match-toast en de pre-match hype. Net als
// coachFeed/coachEvening injecteren we de context (RoastCtx) zodat overal het
// roast-schild + de intensiteit gerespecteerd worden. Geen IO — getest.

import { kiesUniek, roastSeed, type RoastCtx } from "./roastTone";

// ── Dashboard: ochtendbriefing ──────────────────────────────────────────────
const OCHTEND_NEUTRAAL = [
  "Nieuwe dag, nieuwe kansen op de baan.",
  "Klaar voor een balletje? Ik hou het bij.",
  "Succes vandaag — laat die rally's maar komen.",
  "Een dag zonder padel is als een persconferentie zonder microfoons.",
  "Geen opmerkingen vandaag. Ga er gewoon hard tegenaan.",
] as const;
const OCHTEND_DIP = [
  "Een reeks nederlagen bouwt karakter. Heel véél karakter, in jouw geval.",
  "De enige weg is omhoog — lager dan dit kan bijna niet.",
  "Tijd om die grip te vervangen. Of je hele spel.",
  "Ik heb na het WK 2026 ook diep in de spiegel moeten kijken. Mijn advies voor jouw dip? Ander racket, of andere nationaliteit.",
  "Zelfs de Rode Duivels hadden minder tactische flaters dan jouw laatste reeks.",
  "Met elke nederlaag vul ik weer een pagina in mijn beruchte tactische notitieboekje. Mijn pen raakt bijna leeg door jouw spel.",
  "Zelfs mijn meest onbegrijpelijke wissels bij de Rode Duivels vallen in het niet bij deze hopeloze vormcrisis.",
  "Ik heb net een hele bladzijde van mijn notitieboekje rood gekleurd. Jouw vorm is een tactische ramp van WK-proporties.",
  "Een meervoudige nederlaag... Zelfs een tactisch genie als ik kan hier geen positieve draai aan geven.",
] as const;
const OCHTEND_HYPE = [
  "Je bent niet te stoppen. Doe de rest een lol en verlies eens.",
  "Op deze reeks durf ik geld op je te zetten. Bijna.",
  "De vorm van je leven — geniet ervan zolang het duurt.",
  "Een winreeks! Zelfs de Belgische voetbalbond zou nu overwegen je contract te verlengen.",
  "Winst na winst! Zelfs de Belgische pers begint me nu aardig te vinden door jouw prestaties.",
  "Met zo'n vorm hoeven we in de slotminuten niet eens meer tactisch te wisselen.",
] as const;
const OCHTEND_MATCH = [
  "Er staat een match klaar. Warm die smoesjes vast op.",
  "Vandaag de baan op — probeer deze keer wél te winnen.",
  "Je volgende tegenstander slaapt nog. Verrassingsaanval?",
  "Matchdag. Trek je beste pak aan en zet je sportpet op — we gaan voor een tactische moderamp.",
  "Matchdag. Ik heb de tactiek al helemaal uitgetekend in mijn boekje. Of de wissels logisch zijn? Vraag dat maar aan de Belgische pers.",
  "Matchdag! Mijn tactische plan ligt al klaar in mijn binnenzak. Nu jij nog op het veld.",
  "Vandaag staat er weer een match op het programma. Vergeet je pet niet, het kan nat worden langs de lijn.",
] as const;
const OCHTEND_TOP = [
  "Nummer één. Nu alleen nog zo blijven — de haaien ruiken bloed.",
  "Aan de top is het eenzaam. En glad. Kijk uit voor de watersproeiers.",
  "Nummer één! Probeer er niet af te glijden als de sproeiers op het complex plotseling aangaan.",
  "Bovenaan de ranglijst! Dat voelt bijna net zo goed als een persconferentie na een zwaarbevochten zege.",
] as const;
const OCHTEND_ALGEMEEN = [
  "Netjes in de middenmoot. Grijs, maar veilig.",
  "Genoeg gekeken naar het klassement — ga het veranderen.",
  "Vandaag een goeie dag om iemand van hun voetstuk te meppen.",
  "Een stabiele positie. Maar we willen geen stabiliteit, we willen spektakel (en gedurfde wissels)!",
  "De middenmoot is veilig, maar een deugdelijke bondscoach streeft natuurlijk altijd naar meer.",
] as const;

export interface BriefingFeiten {
  rank: number | null;
  /** Lopende winreeks. */
  streak: number;
  /** Lopende verliesreeks. */
  losing: number;
  /** Staat er een geplande match klaar? */
  heeftMatch: boolean;
  seed: string;
  ctx: RoastCtx;
}

/** Eén regel "Coach Rudy over vandaag" voor bovenaan het dashboard. */
export function coachBriefing(f: BriefingFeiten): string {
  const seed = roastSeed("briefing", f.seed);
  if (f.ctx.schild) return kiesUniek(OCHTEND_NEUTRAAL, seed);
  if (f.losing >= 3) return kiesUniek(OCHTEND_DIP, seed);
  if (f.streak >= 3) return kiesUniek(OCHTEND_HYPE, seed);
  if (f.heeftMatch) return kiesUniek(OCHTEND_MATCH, seed);
  if (f.rank === 1) return kiesUniek(OCHTEND_TOP, seed);
  return kiesUniek(OCHTEND_ALGEMEEN, seed);
}

// ── Na het loggen: match-toast ──────────────────────────────────────────────
const MATCH_NEUTRAAL = [
  "Match toegevoegd.",
  "Resultaat ingevoerd. De data liegt niet.",
] as const;
const MATCH_WINST = [
  "Zege genoteerd. Geniet ervan, ze zijn zeldzaam.",
  "Gewonnen! De statistieken kloppen dus nog niet helemaal.",
  "Punten binnen. Toevallig, maar binnen.",
  "Winst! Ik noteer 'm snel voordat de media er een kritische evaluatie over schrijven.",
  "Winst! Snel een krabbel in het notitieboekje. Zelfs een blinde wissel pakt soms goed uit.",
  "Winst! Ik knew it, die tactische aanwijzingen op mijn spiekbriefje waren goud waard.",
  "Prachtige zege. Dit vieren we met een extra persconferentie over hoe fantastisch de tactiek werkte.",
] as const;
const MATCH_BAGEL = [
  "6-0. Dat is geen wedstrijd, dat is een openbare vernedering. Prachtig.",
  "Een droge 6-0 uitgedeeld — dat getuigt van absolute klasse.",
  "6-0! Een absolute masterclass. Zelfs mijn beste tactische plannen konden deze perfectie niet overtreffen.",
  "Geen enkel game weggegeven. Dat is pas efficiëntie, daar kan de bond nog wat van leren.",
] as const;
const MATCH_VERLIES = [
  "Verloren. Maar goed, iemand moet de tegenstander laten stralen.",
  "Nederlaag genoteerd. De grip? Weer niet de oorzaak.",
  "Kop op — er zijn nog genoeg potjes om te verliezen.",
  "Verloren. Net zo kansloos als onze kwartfinale tegen Spanje. Tijd voor een tactische evaluatie.",
  "Verloren. Ik schrijf me helemaal suf in m'n notitieboekje hierlangs, maar ik zie nog steeds geen logica in jouw spel.",
  "Een pijnlijke nederlaag. Misschien had ik je eerder moeten wisselen? Zeg in de 89e minuut?",
  "Verloren. En natuurlijk lag het aan de scheidsrechter, de wind of de bal. Altijd dezelfde excuses!",
  "Met deze nederlaag schrijf ik weer een heel hoofdstuk in mijn memoires. Titel: 'Drama op de grid'.",
] as const;
const MATCH_PAK_SLAAG = [
  "0-6. Ik heb 'm maar meteen in een gouden lijstje gedaan voor de hall of shame.",
  "Met 0-6 ingemaakt. Heb je überhaupt een racket meegenomen?",
  "0-6 verlies. Zelfs Egypte zou ons met deze tactiek uitlachen. Heb je überhaupt voorbesproken?",
  "0-6 verlies. Ik ben sprakeloos, en dat overkomt me werkelijk zelden na een wedstrijd.",
  "Een totale afstraffing. Was je te druk met ruzie maken langs de lijn in plaats van te tennissen?",
] as const;
const MATCH_GELIJK = [
  "Gelijkspel — niemand wint, iedereen twijfelt.",
  "Remise. Spannend noch memorabel, maar genoteerd.",
  "Gelijkspel. Geen winnaar, geen verliezer, gewoon een tactisch schaakspel met nul entertainmentwaarde.",
  "Een puntje erbij. Het houdt de moed erin, maar we gaan hiermee de geschiedenisboeken niet halen.",
] as const;

export interface MatchFeiten {
  uitkomst: "W" | "L" | "D";
  /** Won of verloor iemand met 0 games (bagel)? */
  bagel: boolean;
  seed: string;
  ctx: RoastCtx;
}

/** Coach-quip voor de toast direct na het loggen van een uitslag. */
export function coachMatchQuip(f: MatchFeiten): string {
  const seed = roastSeed("match-toast", f.seed);
  if (f.ctx.schild) return kiesUniek(MATCH_NEUTRAAL, seed);
  if (f.uitkomst === "D") return kiesUniek(MATCH_GELIJK, seed);
  if (f.uitkomst === "W") return kiesUniek(f.bagel ? MATCH_BAGEL : MATCH_WINST, seed);
  return kiesUniek(f.bagel ? MATCH_PAK_SLAAG : MATCH_VERLIES, seed);
}

// ── Vóór een geplande (toto-)match: hype/waarschuwing ───────────────────────
const PRE_NEUTRAAL = [
  "Veel plezier op de baan.",
  "Succes met je volgende match.",
  "Zet 'm op vandaag. Focus op je spel.",
] as const;
const PRE_UNDERDOG = [
  "De bookmaker gelooft niet in je. Bewijs 'm ongelijk (of niet).",
  "Op papier kansloos — maar papier speelt geen padel.",
  "Underdog van dienst. Perfecte dag voor een stunt.",
  "Je winkans is zo laag dat de analisten van Winamax FC je al hebben afgeschreven.",
  "Je bent de absolute underdog. Zelfs de bookmakers hebben al medelijden met je.",
  "De kansberekening ziet er somber uit, maar ik heb wel vaker voor verrassingen gezorgd. Denk aan die ene 89e minuut.",
] as const;
const PRE_FAVORIET = [
  "Torenhoge favoriet. Nu alleen nog even niet verkloten.",
  "Iedereen verwacht dat je wint. Geen druk, hè.",
  "Favoriet op alle fronten — verliezen is geen optie, het is een schande.",
  "Als je deze verliest, mag je direct je koffers pakken. Geen excuses meer!",
  "Op papier de gedoodverfde winnaar. Zorg nou eens dat de werkelijkheid een keer klopt met mijn berekening.",
] as const;
const PRE_GELIJK = [
  "Fiftyfifty op papier. Wie het hardst wil, wint.",
  "Kraker in aantocht — dit kan alle kanten op.",
  "Een heuse kraker. Het type wedstrijd waar een tactische wissel het verschil gaat maken.",
  "Twee gelijkwaardige teams. Mijn notitieblokje ligt klaar om elke blunder te noteren.",
] as const;

/** Korte hype/waarschuwing bij een geplande match, op basis van de winkans
 *  (0..1) van jóuw team. */
export function coachPreMatch(winkans: number, seed: string, ctx: RoastCtx): string {
  const s = roastSeed("prematch", seed);
  if (ctx.schild) return kiesUniek(PRE_NEUTRAAL, s);
  if (winkans < 0.35) return kiesUniek(PRE_UNDERDOG, s);
  if (winkans > 0.65) return kiesUniek(PRE_FAVORIET, s);
  return kiesUniek(PRE_GELIJK, s);
}
