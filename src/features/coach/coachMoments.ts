// Coach Rudy op méér dan de feed (#213): pure, deterministische generators voor
// het dashboard-ochtendpraatje, de match-toast en de pre-match hype. Net als
// coachFeed/coachEvening injecteren we de context (RoastCtx) zodat overal het
// roast-schild + de intensiteit gerespecteerd worden. Geen IO — getest.

import { kiesUniek, roastSeed, type RoastCtx } from "@/features/coach/roastTone";
import type { KlassementFeiten } from "@/features/coach/klassementFeiten";

// ── Dashboard: ochtendbriefing ──────────────────────────────────────────────
const OCHTEND_NEUTRAAL = [
  "Nieuwe dag, nieuwe kansen op de baan.",
  "Klaar voor een balletje? Ik hou het bij.",
  "Succes vandaag — laat die rally's maar komen.",
  "Een dag zonder padel is als een persconferentie zonder microfoons.",
  "Geen opmerkingen vandaag. Ga er gewoon hard tegenaan.",
  "Nieuwe dag, nieuwe kansen om het tactische bord volledig om te gooien.",
  "Klaar voor weer een dag vol onnavolgbare tactische experimenten?",
  "Een nieuwe dag om te laten zien dat tactiek belangrijker is dan puur geluk.",
  "De zon schijnt op de padelbanen. Tijd om wat meters te maken.",
  "Een schone lei vandaag. M'n notitieboekje ligt al opengeslagen.",
  "Ga de kooi in en speel je eigen spel vandaag.",
  "Geen tactische preken vandaag, gewoon gaan met die banaan.",
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
  "Vier nederlagen op rij... M'n pen weigert bijna nog te schrijven.",
  "De vormcrisis is compleet. Tijd om Infantino te bellen voor dispensatie.",
  "Zelfs een getrainde eend had momenteel een actievere forehand.",
  "Tijd voor een crisisberaad in m'n chique pak. Dit kan echt niet meer zo.",
  "Met deze verliesreeks ben je populairder bij de tegenstander dan bij je eigen partner.",
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
  "Je bent onstuitbaar. Zelfs de bondscoach is onder de indruk van je prestaties.",
  "Winst na winst. Mijn notitieboekje raakt vol met louter complimenten.",
  "Een ongekende vorm. Pas op dat je ego de kooi niet doet barsten.",
  "Op deze winreeks mag je best een extra flesje koud zetten.",
  "Je rijgt de zeges aaneen. Heel legaal en heel indrukwekkend.",
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
  "Matchday. Ik heb de reserveballen alvast klaargelegd (voor als je ze weer over de wand jast).",
  "Vandaag moet het gebeuren. Laat die tactische plannen maar spreken.",
  "Matchdag. Probeer de tegenstander vanaf de eerste service bij de keel te grijpen.",
  "Er staat een wedstrijd gepland. Tijd om te bewijzen dat je geen eendagsvlieg bent.",
  "Matchday. Mijn opstelling is gemaakt. Nu de uitvoering nog.",
] as const;
const OCHTEND_TOP = [
  "Nummer één. Nu alleen nog zo blijven — de haaien ruiken bloed.",
  "Aan de top is het eenzaam. En glad. Kijk uit voor de watersproeiers.",
  "Nummer één! Probeer er niet af te glijden als de sproeiers op het complex plotseling aangaan.",
  "Bovenaan de ranglijst! Dat voelt bijna net zo goed als een persconferentie na een zwaarbevochten zege.",
  "Nummer één. Geniet ervan, maar onthoud dat één tactische blunder van mij genoeg is om je te banken.",
  "Bovenaan! Zelfs ik begin nu bijna te geloven dat je daadwerkelijk kunt padellen.",
  "Bovenaan het klassement! Heel legaal en heel cool, zoals Trump zou zeggen.",
  "Bovenaan de lijst. De jagers zijn al onderweg, dus hou je racket scherp.",
  "De nummer één positie. Een meesterwerk van tactisch vernuft en doorzettingsvermogen.",
  "Koning van het klassement. Iedereen wil je van de troon stoten vandaag.",
  "Bovenaan. Geniet ervan, maar blijf alert.",
  "De troon is heet vandaag. Verdedig hem met hand en tand.",
] as const;
const OCHTEND_ALGEMEEN = [
  "Netjes in de middenmoot. Grijs, maar veilig.",
  "Genoeg gekeken naar het klassement — ga het veranderen.",
  "Vandaag een goeie dag om iemand van hun voetstuk te meppen.",
  "Een deugdelijke bondscoach streeft natuurlijk altijd naar meer.",
  "Grijs in de middenmoot. Precies de plek waar kleurloze spelers zonder tactisch vernuft thuishoren.",
  "Stabiel in het midden. Het doet me pijnlijk sterk denken aan mijn meest saaie gelijke spelen.",
  "Nog steeds in de middenmoot. Een uiterst corrupt systeem, we eisen een hertelling van alle Elo-punten!",
  "Middenmoot. De ideale plek voor mensen die bang zijn om te winnen én te lui zijn om te verliezen.",
  "De middenmoot is veilig, maar we zijn hier niet voor comfort.",
  "Stabiel op je positie. Maar stabiliteit is voor ambtenaren, niet voor padellers.",
  "Tijd om wat plekken te stijgen vandaag. De top is nog ver.",
  "Vandaag een ideale dag om de ranglijst flink op te schudden.",
  "In het midden van het pak. Sluip geruisloos dichter bij de top.",
] as const;
// Tier-pools van de briefing (#411). Geëxporteerd voor de tak-tests, net als
// KAMPIOEN in coachFeed.
export const OCHTEND_JAGER = [
  "Goedemorgen, jager. De nummer één ontbijt vandaag met een onrustig gevoel.",
  "Je staat vlak achter de koploper. Vandaag lijkt me een prima dag voor een machtsgreep.",
  "Zo dicht bij de top. Ik heb de aanvalsplannen al klaarliggen in m'n notitieboekje.",
  "De troon is bijna binnen handbereik. Nog even doorbijten, dan mag je zwaaien naar beneden.",
  "Tweede viool? Vandaag stemmen we 'm om naar eerste.",
  "De kop is in zicht. Wie boven je staat, voelt vandaag iemand hijgen in z'n nek.",
  "Jagen doe je 's ochtends vroeg. De koploper hoort je al aankomen.",
  "Bijna bovenaan het klassement. Eén tactische zet — van mij uiteraard — en het kantelt.",
  "Vandaag geen genade: de nummer één is oud nieuws zodra jij de baan op stapt.",
  "De achtervolging loopt. Ik heb m'n pet schuin gezet, dat doe ik alleen bij titelkansen.",
  "Zo hoog in de lijst, en toch nog niet bovenaan. Dat jeukt, hè? Mooi. Gebruik het.",
  "De top-3 is je uitvalsbasis. Vandaag verkennen we het gebied daarboven.",
  "De koploper voelt de druk. Vandaag is de dag om toe te slaan.",
  "Vlak achter de top. Eén goede match en je pakt de koppositie.",
  "Je staat op scherp om de troon te bestormen. Geen genade vandaag.",
  "Als jager moet je geduldig zijn, en op het juiste moment toeslaan. Vandaag?",
  "De top-3 is leuk, maar de nummer één positie glanst toch echt harder.",
] as const;
export const OCHTEND_KELDER = [
  "Goedemorgen vanuit de kelder van het klassement. Het ontbijt smaakt daar hetzelfde, de ambitie hopelijk niet.",
  "Onderin de lijst. Vandaag lijkt me een uitstekende dag om daar iets aan te doen.",
  "De rode lantaarn hangt aan jouw naam. Draag 'm vandaag over aan iemand anders.",
  "Onderaan het klassement. De enige weg is omhoog, en die begint bij de eerstvolgende match.",
  "De kelder. Ik heb er een motiverende krabbel over gemaakt in m'n notitieboekje: 'omhoog, nu'.",
  "Laag in de stand. Niks dat een paar gewonnen potten niet kunnen oplossen.",
  "Hekkensluiter. Iemand moet het zijn, maar het staat je niet.",
  "Onderin. Zelfs de watersproeiers sproeien daar met een vleugje medelijden.",
  "De onderste regionen van de lijst. Tijd voor een gedurfde wissel: verliezen inruilen voor winnen.",
  "Je positie is een tactische ramp, maar elke comeback begint met één zege. Vandaag?",
  "De kelder van het klassement. Ik zet alvast koffie voor de klim naar boven.",
  "Onderaan. M'n viool speelt zachtjes, maar m'n fluitje staat klaar voor de training.",
  "Onderaan het klassement. De weg omhoog is de enige optie.",
  "Hekkensluiter voor nu. Maar met de juiste tactiek klim je er zo weer uit.",
  "De kelderklasse. Laat zien dat je er niet thuishoort vandaag.",
  "Tijd om die rode lantaarn door te geven aan een ander.",
  "Onderin de tabel. Blijf trainen, de ommekeer begint vandaag.",
] as const;
export const OCHTEND_NIEUW = [
  "Nieuw in het klassement. Vandaag is een mooie dag om je Elo een verhaal te geven.",
  "Te weinig matches voor een oordeel. Dat lost zichzelf op: de baan wacht.",
  "Je rating is nog aan het indraaien. Een paar potten en we weten wie je bent.",
  "Verse naam op de lijst. Ik heb een nieuwe bladzijde aangebroken — hou 'm schoon of maak 'm legendarisch.",
  "Nog geen echte positie. Mooi zo: alles wat je vandaag wint is pure winst.",
  "De statistieken kennen je amper. Verras ze.",
  "Nieuw op de ranglijst. Zelfs ik heb nog geen mening, en dat is zeldzaam.",
  "Blanco reputatie. Sommigen noemen dat eng, ik noem het een kans.",
  "Je Elo is nog een schatting. Vandaag kun je 'm een richting geven.",
  "Net gestart in het klassement. Onthoud: elke nummer één is ooit onderaan begonnen.",
  "De teller staat nog bijna op nul. Perfecte dag om 'm te laten lopen.",
  "Nieuwkomer. Ik kijk vandaag extra goed mee, met m'n pen in de aanslag.",
  "Net binnengekomen op de lijst. Tijd om je rating serieus te gaan bouwen.",
  "De statistieken zijn nog blanco. Maak er een mooi verhaal van.",
  "Welkom in het klassement. Laat je eerste match direct een statement zijn.",
  "Nog geen historie hier. Die ga je vanaf vandaag zelf schrijven.",
  "De eerste Elo-schattingen zijn binnen. Tijd voor de echte cijfers.",
] as const;

export interface BriefingFeiten {
  rank: number | null;
  /** Lopende winreeks. */
  streak: number;
  /** Lopende verliesreeks. */
  losing: number;
  /** Staat er een geplande match klaar? */
  heeftMatch: boolean;
  /** Klassement-feiten (#411); zonder dit veld geldt het oude rank===1-gedrag. */
  klassement?: KlassementFeiten | null;
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
  switch (f.klassement?.tier) {
    case "troon":
      return kiesUniek(OCHTEND_TOP, seed);
    case "jager":
      return kiesUniek(OCHTEND_JAGER, seed);
    case "kelder":
      return kiesUniek(OCHTEND_KELDER, seed);
    case "nieuw":
      return kiesUniek(OCHTEND_NIEUW, seed);
  }
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
  "Een glansrijke zege. M'n notitieboekje trilt nog van opwinding.",
  "Winst! De persconferentie van vanavond zal louter positief zijn.",
  "Punten in de pocket. Het was een tactisch schaakspel met jou als grootmeester.",
  "Winst. Heel verdiend, al mag je partner ook wel wat credits krijgen.",
  "Gewonnen. Snel inschrijven voor het volgende niveau voor een echte test.",
] as const;
const MATCH_BAGEL = [
  "6-0. Dat is geen wedstrijd, dat is een openbare vernedering. Prachtig.",
  "Een droge 6-0 uitgedeeld — dat getuigt van absolute klasse.",
  "6-0! Een absolute masterclass. Zelfs mijn beste tactische plannen konden deze perfectie niet overtreffen.",
  "Geen enkel game weggegeven. Dat is pas efficiëntie, daar kan de bond nog wat van leren.",
  "6-0 winst! Dit was bijna net zo makkelijk als een persconferentie na een gewonnen oefenwedstrijd tegen een amateurteam.",
  "6-0! Een absolute afdroging. De tegenstander wist niet eens waar de kooi was.",
  "Een droge 6-0. De definitie van efficiëntie en tactische dominantie.",
  "Bagel uitgedeeld! Zelfs de tegenstanders klapten stilletjes mee.",
  "6-0 winst! Dit was bijna te makkelijk om serieus in m'n boekje te noteren.",
  "Geen game weggegeven. A masterclass in omschakelingspadel.",
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
  "Verloren. Mijn tactische bord ligt momenteel in scherven op de kleedkamervloer.",
  "Een nederlaag. Dit vraagt om een diepgaande analyse en een heleboel strafrondjes.",
  "Verloren. Zelfs een blinde scheidsrechter had gezien dat de tactiek niet werkte.",
  "Nederlaag. De tegenstander profiteerde optimaal van jullie positionele chaos.",
  "Verloren. Zorg dat je racket de volgende match wél goed gestemd is.",
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
  "0-6 afdroging. Ik heb m'n pet diep over m'n ogen getrokken toen ik dit zag.",
  "Met 0-6 weggespeeld. Zelfs de watersproeiers toonden meer bezieling.",
  "Een totale instorting. Dit was geen padel, dit was een ramp van WK-proporties.",
  "0-6 verlies. We eisen per direct een hertelling van de geslagen ballen.",
  "Nul games gepakt. Zelfs met Infantino aan de lijn valt dit niet goed te praten.",
] as const;
const MATCH_GELIJK = [
  "Gelijkspel — niemand wint, iedereen twijfelt.",
  "Remise. Spannend noch memorabel, maar genoteerd.",
  "Gelijkspel. Geen winnaar, geen verliezer, gewoon een tactisch schaakspel met nul entertainmentwaarde.",
  "Een puntje erbij. Het houdt de moed erin, maar we gaan hiermee de geschiedenisboeken niet halen.",
  "Gelijkspel. De ultieme demonstratie van angst om te verliezen en tactisch lafbekken-gedrag.",
  "Gelijkspel. De gulden middenweg, maar we willen bloed zien.",
  "Remise. Een tactische patstelling waar niemand echt vrolijk van wordt.",
  "Gelijkspel. Twee ploegen die vooral bang waren om te verliezen.",
  "Een punt gedeeld. Het houdt de moed erin, maar de ambitie niet.",
  "Gelijk. Tijd om de videobeelden te bestuderen om te zien waar het stilviel.",
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
  "De kansberekening is genadeloos: je bent de underdog. Tijd voor een tactisch wonder.",
  "Underdog op papier. Maar papier wint geen rally's, jij hopelijk wel.",
  "De winkans is klein, maar de motivatie moet des te groter zijn.",
  "Als underdog speel je zonder druk. Gebruik dat in je voordeel.",
  "Analisten geven je weinig kans. Laat ze de tanden maar zien vandaag.",
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
  "Torenhoge favoriet vandaag. Laat zien waarom je bovenaan de lijst staat.",
  "Iedereen rekent op winst. Zorg dat je de concentratie vasthoudt.",
  "Favoriet van dienst. Verlies dit niet, anders raakt m'n notitieboekje oververhit.",
  "Op papier ben je de betere. Nu de baan op en dat waarmaken.",
  "Als favoriet moet je dominant spelen. Geen excuses vandaag.",
] as const;
const PRE_GELIJK = [
  "Fiftyfifty op papier. Wie het hardst wil, wint.",
  "Kraker in aantocht — dit kan alle kanten op.",
  "Een heuse kraker. Het type wedstrijd waar een tactische wissel het verschil gaat maken.",
  "Twee gelijkwaardige teams. Mijn notitieblokje ligt klaar om elke blunder te noteren.",
  "Gelijkwaardig? Tactisch gezien voorzie ik vooral een hoop onnodig balverlies en misverstanden aan beide kanten.",
  "Fiftyfifty. Dit wordt een strijd tegen een rigged systeem. Houd je racket stevig vast.",
  "Gelijkwaardige match vooraf. Dat betekent dat degene met de minste tactische flaters er met de winst vandoor gaat.",
  "Fiftyfifty vooraf. Dit wordt beslist op details en tactische discipline.",
  "Een uiterst evenwichtige match. Wie het minst fouten maakt, wint.",
  "Spanning gegarandeerd. Twee teams die elkaar geen duimbreed toegeven.",
  "Een kraker. Het type wedstrijd waar je voor leeft als padeller.",
  "Gelijkwaardig op papier. Laat zien dat je tactisch slimmer bent.",
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

// Licht plagend welkom voor wie zijn intensiteit hoger dan "mild" heeft staan
// (en geen schild draagt): Rudy mag knipogen, maar een nieuwe gebruiker krijgt
// nooit een echte burn — er valt immers nog niets te roasten.
const EMPTY_WELKOM_PLAAG = [
  "Welkom! Nul matches, nul nederlagen — statistisch gezien is dit je beste moment ooit.",
  "Zo, een nieuwe uitdager. Ik heb mijn tactische notitieboekje alvast opengeslagen op een lege pagina.",
  "Welkom bij de club. Rating 1000 — geniet ervan, zo netjes rond wordt het nooit meer.",
  "Nieuw hier? Onderaan beginnen heeft één voordeel: je kunt alleen maar stijgen. In theorie.",
  "Welkom! Je krijgt van mij één gratis compliment: je bent er. De rest verdien je op de baan.",
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
 *  Bewust mild (#301): groep- en matchespools zijn altijd verwelkomend; op het
 *  dashboard mag Rudy licht plagen bij intensiteit boven "mild", maar schild
 *  aan of intensiteit "mild" geeft het warme welkom. */
export function coachEmptyState(f: EmptyStateFeiten): string {
  const seed = roastSeed("empty", f.seed);
  if (f.type === "group") return kiesUniek(EMPTY_GROUP, seed);
  if (f.type === "matches") return kiesUniek(EMPTY_NEUTRAAL, seed);
  if (f.ctx.schild || f.ctx.intensiteit === "mild")
    return kiesUniek(EMPTY_WELKOM, seed);
  return kiesUniek(EMPTY_WELKOM_PLAAG, seed);
}

// ── Vrienden: rivalen, verzoeken & head-to-head (#294) ──────────────────────
// Schild aan → een warme, niet-spottende regel: wie geen roast wil, krijgt er
// geen. Voor de rest schakelt coachVrienden op de situatie, en bij head-to-head
// op het teken van de onderlinge balans (winst − verlies vanuit de kijker).
export const VRIENDEN_NEUTRAAL = [
  "Vrienden maken de baan leuker. Zoek je maatjes gerust op.",
  "Samen padellen is dubbel plezier. Voeg wat spelers toe.",
  "Een goede rivaal is goud waard. Nodig er een paar uit.",
  "Bouw rustig je eigen padel-kringetje op.",
  "Meer vrienden, meer matches om te loggen. Zo simpel is het.",
] as const;

export const VRIENDEN_LEEG = [
  "Nul vrienden. Net als op mijn afscheidsreceptie.",
  "Een lege vriendenlijst. Zelfs mijn selectie bij de Rode Duivels was voller, en dat zegt wat.",
  "Je vriendenlijst is leger dan mijn notitieboekje na een gewonnen match. Nodig eens iemand uit.",
  "Zo stil hier. Zelfs de watersproeiers op veld 2 hebben meer sociale contacten dan jij nu.",
  "Nul bondgenoten, nul rivalen. Tactisch gezien een onmogelijke uitgangspositie.",
  "Een vriendenlijst zo kaal als de tribune bij een training op maandagochtend. Voeg wat volk toe.",
  "Helemaal alleen op de baan? Zelfs bij Napoli gaf men mij nog een hand.",
  "Geen enkele vriend. Tijd om net zo fanatiek te ronselen als ik ooit naar tactische excuses zocht.",
  "Onderaan de sociale ranglijst. De enige weg is omhoog: nodig je eerste speler uit.",
] as const;

export const VRIENDEN_NIEUW = [
  "Een nieuwe naam op de vijandenlijst. Ik noteer 'm alvast in m'n notitieboekje.",
  "Verzoek de deur uit. Nu maar hopen dat je nieuwe rivaal net zo slecht speelt als jij.",
  "Vers bloed in je kringetje. Tijd om die vriendschap op de baan grondig te testen.",
  "Een nieuwe rivaal in de maak. Ik verheug me nu al op het onderlinge bloedbad.",
  "Zo, een uitnodiging verstuurd. Straks staat er iemand nieuws om van te verliezen.",
  "Nieuwe vriend, nieuwe tegenstander. In de padel is dat exact hetzelfde.",
  "Verzoek verstuurd. Ik zet de tactische scherpstelling alvast klaar voor jullie eerste duel.",
  "Een frisse naam op de lijst. Onthoud: vandaag vrienden, straks concurrenten om de eerste plek.",
] as const;

export const H2H_LEIDT = [
  "Tegen deze vriend ben jij de baas. Blijf dat vooral inwrijven.",
  "In de onderlinge stand leid jij. Zorg dat het zo blijft, anders krijg ik commentaar van de pers.",
  "Deze rivaal heb je in je zak — op papier tenminste. Nu nog op de baan bevestigen.",
  "Jij wint dit duel meestal. Een tactisch genie als ik ziet daar graag een patroon in.",
  "Voorsprong in de onderlinge balans. Geniet ervan, voorsprongen zijn broos in de padel.",
  "Deze vriend verslaat je zelden. Hou die reputatie hoog, ik noteer elk duel.",
] as const;

export const H2H_ACHTER = [
  "Tegen deze vriend sta je achter. Tijd voor een tactische ommekeer, zeg ik als expert.",
  "Deze rivaal heeft de overhand. Pijnlijk, maar de cijfers liegen niet.",
  "In jullie onderlinge duels trek jij aan het kortste eind. Werk aan de winkel.",
  "Deze vriend zit in je hoofd. Volgende keer eens wél winnen, als tactisch experiment?",
  "De balans slaat door naar de verkeerde kant. Ik heb er een boos krabbeltje over gemaakt.",
  "Deze rivaal is jouw angstgegner. Tijd om die vloek eindelijk te doorbreken.",
] as const;

export const H2H_GELIJK = [
  "Kop aan kop met deze rivaal. Dit soort duels beslist de tactiek — de mijne dus.",
  "Perfect in evenwicht, deze onderlinge stand. De volgende match breekt de gelijkstand.",
  "Jullie ontlopen elkaar geen meter. Precies het soort kraker waar ik voor leef.",
  "Gelijk op tegen deze vriend. Wie het minst blundert, pakt straks de overhand.",
  "Een nek-aan-nekrace in de onderlinge balans. Spannend, maar ik wil bloed zien.",
  "Volledig in balans, jullie twee. Eén goede match en de weegschaal slaat door.",
] as const;

export interface VriendenFeiten {
  /** Welke situatie op /vrienden vraagt om Coach Rudy's stem. */
  situatie: "leeg" | "nieuw" | "h2h";
  /** Alleen bij "h2h": onderlinge balans als tegenstanders, vanuit de kijker. */
  balans?: { gewonnen: number; verloren: number; gespeeld: number };
  seed: string;
  ctx: RoastCtx;
}

/** Coach Rudy op de vriendenpagina (#294): lege lijst, een nieuw verzoek of een
 *  head-to-head-vooruitblik o.b.v. de onderlinge balans. Schild aan → een warme,
 *  neutrale regel (plagen, geen kwetsen). Deterministisch geseed. */
export function coachVrienden(f: VriendenFeiten): string {
  const seed = roastSeed("vrienden", f.seed);
  if (f.ctx.schild) return kiesUniek(VRIENDEN_NEUTRAAL, seed);
  if (f.situatie === "leeg") return kiesUniek(VRIENDEN_LEEG, seed);
  if (f.situatie === "nieuw") return kiesUniek(VRIENDEN_NIEUW, seed);
  const saldo = f.balans ? f.balans.gewonnen - f.balans.verloren : 0;
  if (saldo > 0) return kiesUniek(H2H_LEIDT, seed);
  if (saldo < 0) return kiesUniek(H2H_ACHTER, seed);
  return kiesUniek(H2H_GELIJK, seed);
}
