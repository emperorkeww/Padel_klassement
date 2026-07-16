// Coach Rudy op méér dan de feed (#213): pure, deterministische generators voor
// het dashboard-ochtendpraatje, de match-toast en de pre-match hype. Net als
// coachFeed/coachEvening injecteren we de context (RoastCtx) zodat overal het
// roast-schild + de intensiteit gerespecteerd worden. Geen IO — getest.

import { kiesUniek, roastSeed, type RoastCtx } from "@/features/coach/roastTone";

// ── Dashboard: ochtendbriefing ──────────────────────────────────────────────
const OCHTEND_NEUTRAAL = [
  "Nieuwe dag, nieuwe kansen op de baan.",
  "Klaar voor een balletje? Ik hou het bij.",
  "Succes vandaag — laat die rally's maar komen.",
  "Een dag zonder padel is als een persconferentie zonder microfoons.",
  "Geen opmerkingen vandaag. Ga er gewoon hard tegenaan.",
  "Nieuwe dag, nieuwe kansen om het tactische bord volledig om te gooien.",
  "Klaar voor weer een dag vol onnavolgbare tactische experimenten?",
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
  "Zelfs de slechtste bondscoach ter wereld had je na deze serie allang geruisloos naar de tribune verwezen.",
  "Met zo'n verliesreeks is je rating sneller gedaald dan mijn populariteit bij de Belgische sportpers.",
  "Ik ben serieus aan het overwegen om een viervoudige wissel door te voeren in je hele dagelijkse routine.",
  "Zelfs als ik Donald Trump inschakel om Infantino persoonlijk te bellen, is er geen reglementaire basis om deze dip te redden.",
  "Je verliesreeks is zo lang dat zelfs de FIFA-disciplinaire commissie hier geen voorwaardelijke opschorting voor kan verzinnen.",
  "Een dip? Fake news! Mijn tactische notitieboekje bevat alleen maar virtuele overwinningen. De statistieken zijn gemanipuleerd.",
  "Ik heb net mijn tactische notitieboekje ritueel verbrand. Jouw verliesreeks is met geen enkele theorie meer te verklaren.",
  "Wakker worden! Jouw vorm is momenteel zo diep gezonken dat we de marine moeten inschakelen om je niveau te bergen.",
] as const;
const OCHTEND_HYPE = [
  "Je bent niet te stoppen. Doe the rest een lol en verlies eens.",
  "Op deze reeks durf ik geld op je te zetten. Bijna.",
  "De vorm van je leven — geniet ervan zolang het duurt.",
  "Een winreeks! Zelfs de Belgische voetbalbond zou nu overwegen je contract te verlengen.",
  "Winst na winst! Zelfs de Belgische pers begint me nu aardig te vinden door jouw prestaties.",
  "Met zo'n vorm hoeven we in de slotminuten niet eens meer tactisch te wisselen.",
  "Een winreeks! Laat het alsjeblieft niet naar je hoofd stijgen, je bent nog steeds geen GOAT.",
  "Je wint momenteel alles. Heb je stiekem de tegenstander omgekocht met een doos Belgische pralines?",
  "Een winreeks! Je claimt dat je de beste speler bent in de geschiedenis van de club. Zeer Trumpiaanse trekjes.",
] as const;
const OCHTEND_MATCH = [
  "Er staat een match klaar. Warm die smoesjes vast op.",
  "Vandaag de baan op — probeer deze keer wél te winnen.",
  "Je volgende tegenstander slaapt nog. Verrassingsaanval?",
  "Matchdag. Trek je beste pak aan en zet je sportpet op — we gaan voor een tactische moderamp.",
  "Matchdag. Ik heb de tactiek al helemaal uitgetekend in mijn boekje. Of de wissels logisch zijn? Vraag dat maar aan de Belgische pers.",
  "Matchdag! Mijn tactische plan ligt al klaar in mijn binnenzak. Nu jij nog op het veld.",
  "Vandaag staat er weer een match op het programma. Vergeet je pet niet, het kan nat worden langs de lijn.",
  "Matchdag. Probeer deze keer de bal wél over het net te krijgen. Gewoon als uniek experiment.",
  "Matchdag! Mijn tactische spiekbriefje ligt al in de prullenbak, want aan jouw spel valt werkelijk geen tactiek te koppelen.",
  "Matchdag! Mijn tactische plan is simpel: we kopen de scheidsrechter om en als dat faalt bellen we de president.",
  "Matchdag. We gaan de tegenstander zo hard inmaken dat Gianni Infantino achteraf excuses moet aanbieden aan Bosnië.",
  "Er staat een match klaar. Ik heb de EHBO alvast stand-by gezet voor het geval je weer over je eigen voeten struikelt.",
] as const;
const OCHTEND_TOP = [
  "Nummer één. Nu alleen nog zo blijven — de haaien ruiken bloed.",
  "Aan de top is het eenzaam. En glad. Kijk uit voor de watersproeiers.",
  "Nummer één! Probeer er niet af te glijden als de sproeiers op het complex plotseling aangaan.",
  "Bovenaan de ranglijst! Dat voelt bijna net zo goed als een persconferentie na een zwaarbevochten zege.",
  "Nummer één. Geniet ervan, maar onthoud dat één tactische blunder van mij genoeg is om je te banken.",
  "Bovenaan! Zelfs ik begin nu bijna te geloven dat je daadwerkelijk kunt padellen.",
  "Bovenaan het klassement! Heel legaal en heel cool, zoals Trump zou zeggen.",
] as const;
const OCHTEND_ALGEMEEN = [
  "Netjes in de middenmoot. Grijs, maar veilig.",
  "Genoeg gekeken naar het klassement — ga het veranderen.",
  "Vandaag een goeie dag om iemand van hun voetstuk te meppen.",
  "Een stabiele positie. Maar we willen geen stabiliteit, we willen spektakel (en gedurfde wissels)!",
  "De middenmoot is veilig, maar een deugdelijke bondscoach streeft natuurlijk altijd naar meer.",
  "Grijs in de middenmoot. Precies de plek waar kleurloze spelers zonder tactisch vernuft thuishoren.",
  "Stabiel in het midden. Het doet me pijnlijk sterk denken aan mijn meest saaie gelijke spelen.",
  "Nog steeds in de middenmoot. Een uiterst corrupt systeem, we eisen een hertelling van alle Elo-punten!",
  "Middenmoot. De ideale plek voor mensen die bang zijn om te winnen én te lui zijn om te verliezen.",
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
  "Winst! Gelukkig speelde je partner mee, anders hadden we hier nu een heel ander (en pijnlijker) verhaal geschreven.",
  "Winst. Geniet ervan, maar je service was nog steeds om te janken.",
  "Winst! Een overwinning van historische, Trumpiaanse proporties. The greatest ever, geloof me.",
  "Winst! Een gigantische zege, de grootste in de geschiedenis van deze padelbaan. Absoluut enorm.",
] as const;
const MATCH_BAGEL = [
  "6-0. Dat is geen wedstrijd, dat is een openbare vernedering. Prachtig.",
  "Een droge 6-0 uitgedeeld — dat getuigt van absolute klasse.",
  "6-0! Een absolute masterclass. Zelfs mijn beste tactische plannen konden deze perfectie niet overtreffen.",
  "Geen enkel game weggegeven. Dat is pas efficiëntie, daar kan de bond nog wat van leren.",
  "6-0 winst! Dit was bijna net zo makkelijk als een persconferentie na een gewonnen oefenwedstrijd tegen een amateurteam.",
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
  "Verloren. Mijn tactische analyse is pijnlijk simpel: je hebt er gewoon geen gevoel voor.",
  "Verloren. Gelukkig hebben we het tactische roodschrijvende notitieboekje om je falen tot in de eeuwigheid te vereeuwigen.",
  "Verloren. Pure oplichting! We gaan de uitslag per direct aanvechten bij Gianni Infantino.",
  "Verloren. De tegenstander maakte misbruik van een corrupt systeem. Dit was een volledig 'rigged' wedstrijd!",
  "Verloren. Zelfs de watersproeiers op veld 2 toonden na de match meer bezieling en richtinggevoel dan jouw slagen.",
  "Nederlaag. Ik stel voor dat we deze wedstrijd snel wissen uit het geheugen, en bij voorkeur ook uit de database.",
] as const;
const MATCH_PAK_SLAAG = [
  "0-6. Ik heb 'm maar meteen in een gouden lijstje gedaan voor de hall of shame.",
  "Met 0-6 ingemaakt. Heb je überhaupt een racket meegenomen?",
  "0-6 verlies. Zelfs Egypte zou ons met deze tactiek uitlachen. Heb je überhaupt voorbesproken?",
  "0-6 verlies. Ik ben sprakeloos, en dat overkomt me werkelijk zelden na een wedstrijd.",
  "Een totale afstraffing. Was je te druk met ruzie maken langs de lijn in plaats van te tennissen?",
  "0-6 verlies. Ik zou me stilletjes via de achterdeur uit de club loodsen om de pers te ontwijken.",
  "0-6. Zelfs de kantinejuffrouw had na 3 games haar jas al aangetrokken en de lichten half uitgedaan.",
  "0-6 verlies. Dit was geen wedstrijd, dit was een corrupt complot van de tegenpartij. Stop the steal!",
  "0-6 verlies. We eisen dat dit resultaat direct ongeldig wordt verklaard. Een schande voor de sport!",
  "0-6 verlies. Dit deed zo ontiegelijk veel pijn aan de ogen dat ik spontaan mijn licentie als coach wil inleveren.",
  "Volledig weggespeeld. Het was net alsof je probeerde de bal te raken met een kookpan in plaats van een racket.",
] as const;
const MATCH_GELIJK = [
  "Gelijkspel — niemand wint, iedereen twijfelt.",
  "Remise. Spannend noch memorabel, maar genoteerd.",
  "Gelijkspel. Geen winnaar, geen verliezer, gewoon een tactisch schaakspel met nul entertainmentwaarde.",
  "Een puntje erbij. Het houdt de moed erin, maar we gaan hiermee de geschiedenisboeken niet halen.",
  "Gelijkspel. De ultieme demonstratie van angst om te verliezen en tactisch lafbekken-gedrag.",
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
  "Je winkans is zo minimaal dat zelfs je eigen partner stiekem geld heeft ingezet op de tegenstander.",
  "Kansloos vooraf. Onze enige hoop is dat de tegenstander een rode kaart krijgt die daarna NIET voorwaardelijk wordt opgeschort.",
  "Underdog op papier. Maar we gaan Infantino bellen om de regels te veranderen voordat de match begint.",
  "Kansloos volgens de cijfers. Maar we weigeren dit resultaat bij voorbaat te accepteren. Fake stats!",
  "Op papier kansloos. Mijn advies? Begin vast met het verzinnen van een heel creatief excuus voor achteraf.",
  "Analisten geven je nul procent kans. Zelfs de ballenjongens hebben al medelijden met je voetenwerk.",
] as const;
const PRE_FAVORIET = [
  "Torenhoge favoriet. Nu alleen nog even niet verkloten.",
  "Iedereen verwacht dat je wint. Geen druk, hè.",
  "Favoriet op alle fronten — verliezen is geen optie, het is een schande.",
  "Als je deze verliest, mag je direct je koffers pakken. Geen excuses meer!",
  "Op papier de gedoodverfde winnaar. Zorg nou eens dat de werkelijkheid een keer klopt met mijn berekening.",
  "Als je deze verliest, schrijf ik eigenhandig een driepaginalange brief aan het clubbestuur om je per direct te schorsen.",
  "Torenhoge favoriet. Mocht het toch misgaan, dan claimen we gewoon dat de telling corrupt was en dat de winst gestolen is.",
  "Favoriet! Zelfs met een corrupte scheidsrechter en tegenwind gaan we deze overwinning sowieso opeisen.",
  "Torenhoge favoriet. Verlies dit niet, anders mag je de rest van het seizoen eigenhandig de banen gaan vegen.",
] as const;
const PRE_GELIJK = [
  "Fiftyfifty op papier. Wie het hardst wil, wint.",
  "Kraker in aantocht — dit kan alle kanten op.",
  "Een heuse kraker. Het type wedstrijd waar een tactische wissel het verschil gaat maken.",
  "Twee gelijkwaardige teams. Mijn notitieblokje ligt klaar om elke blunder te noteren.",
  "Gelijkwaardig? Tactisch gezien voorzie ik vooral een hoop onnodig balverlies en misverstanden aan beide kanten.",
  "Fiftyfifty. Dit wordt een strijd tegen een rigged systeem. Houd je racket stevig vast.",
  "Gelijkwaardige match vooraf. Dat betekent dat degene met de minste tactische flaters er met de winst vandoor gaat.",
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

// ── Lege staten & onboarding ──────────────────────────────────────────────
const EMPTY_NEUTRAAL = [
  "Tijd om de kooi in te duiken! De banen wachten op jouw eerste bal.",
  "Nog geen match gespeeld? De perfecte dag om dat te veranderen.",
  "Leeg canvas, volle mogelijkheden. Waar wacht je op?",
  "Elke grote speler begon ooit met één enkele match. Jij bent aan de beurt.",
  "De baan ligt er klaar voor. Jij ook?",
  "Geen persoonlijke statistieken? Dat lossen we zo op.",
  "Je profiel is klaar. Nu nog even die eerste wedstrijd winnen.",
] as const;

const EMPTY_WELKOM = [
  "Welkom in de wereld van Padel Klassement! Speel je eerste match en ontdek je niveau.",
  "Leuk dat je er bent! Tijd om te laten zien wat je in huis hebt.",
  "Nieuw hier? Geen zorgen — iedereen begon ooit met nul matches en oneindig potentieel.",
  "Welkom! De eerste stap is altijd de zwaarste. De tweede is: match loggen.",
  "Fijn dat je meedoet. Nu nog even een tegenstander regelen...",
  "Je account is klaar. Nu nog de rest van de wereld verslaan.",
] as const;

const EMPTY_GROUP = [
  "Deze groep is nog leeg als een net geopend blik. Nodig vrienden uit!",
  "Een groep zonder leden is als een padelbaan zonder net. Tijd om dat te fixen.",
  "Jij bent de eerste! Nodig je speelmaatjes uit om de competitie te starten.",
  "Een groep met één lid is technisch gezien een solo-act. Laten we dat veranderen.",
  "Deze groep wacht op jouw vrienden. Deel die invite-link!",
  "Eenzaam aan de top? Nodig anderen uit om je van je troon te stoten.",
] as const;

export interface EmptyStateFeiten {
  type: "dashboard" | "group" | "matches";
  seed: string;
  ctx: RoastCtx;
}

/** Coach-quip voor lege staten (onboarding, nieuwe groep, geen matches).
 *  Gebruikt altijd een milde, verwelkomende toon voor onboarding-scenario's.
 *  Respecteert het roast-schild: bij schild aan worden neutrale teksten getoond. */
export function coachEmptyState(f: EmptyStateFeiten): string {
  const seed = roastSeed("empty", f.seed);
  if (f.ctx.schild) {
    if (f.type === "group") return kiesUniek(EMPTY_GROUP, seed);
    return kiesUniek(EMPTY_NEUTRAAL, seed);
  }
  if (f.type === "group") return kiesUniek(EMPTY_GROUP, seed);
  if (f.type === "matches") return kiesUniek(EMPTY_NEUTRAAL, seed);
  return kiesUniek(EMPTY_WELKOM, seed);
}
