// Coach Rudy op méér dan de feed (#213): pure, deterministische generators voor
// het dashboard-ochtendpraatje, de match-toast en de pre-match hype. Net als
// coachFeed/coachEvening injecteren we de context (RoastCtx) zodat overal het
// roast-schild + de intensiteit gerespecteerd worden. Geen IO — getest.

import {
  kiesUniek,
  roastSeed,
  type RoastCtx,
  type RoastIntensiteit,
} from "@/features/coach/roastTone";
import type { KlassementFeiten } from "@/features/coach/klassementFeiten";
import type { TierKey } from "@/features/rating/tiers";

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
  "Kolfje naar mijn hand: een rustige ochtend om te focussen op de looplijnen.",
  "Zorg dat je racket vandaag niet aanvoelt als een natte dweil.",
  "Laat de ballen vandaag maar vliegen, bij voorkeur wel binnen de kooi.",
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
  "Zelfs de slechtste bondscoach had je na al die nederlagen allang naar de tribune verwezen.",
  "Met zo'n reeks nederlagen is je rating sneller gedaald dan mijn populariteit bij de Belgische sportpers.",
  "Ik ben serieus aan het overwegen om na deze nederlaag een viervoudige wissel door te voeren.",
  "Zelfs als ik Donald Trump inschakel om Infantino persoonlijk te bellen, is er geen reglementaire basis om deze dip te redden.",
  "Je verliesreeks is zo lang dat zelfs de FIFA-disciplinaire commissie hier geen voorwaardelijke opschorting voor kan verzinnen.",
  "Een dip? Fake news! Mijn tactische notitieboekje bevat alleen maar virtuele overwinningen. De statistieken zijn gemanipuleerd.",
  "Ik heb net mijn tactische notitieboekje ritueel verbrand. Jouw verliesreeks is met geen enkele theorie meer te verklaren.",
  "Wakker worden! Jouw vorm is momenteel zo diep gezonken dat we de marine moeten inschakelen om je niveau te bergen.",
  "Vier nederlagen op rij... M'n pen weigert bijna nog te schrijven.",
  "De vormcrisis is compleet. Tijd om Infantino te bellen voor dispensatie.",
  "Kijk eens in de spiegel: zelfs een getrainde eend had momenteel een actievere forehand.",
  "Tijd voor een crisisberaad over deze nederlaag. Dit kan echt niet meer zo.",
  "Met al die nederlagen ben je populairder bij de tegenstander dan bij je partner.",
  "Na zoveel nederlagen kun je beter op de tribune gaan zitten.",
  "Deze reeks nederlagen begint astronomische vormen aan te nemen. Aurelio had je al ontslagen.",
  "Tijd om de beelden van deze nederlaag te analyseren. Doe het wel met een zonnebril op.",
  "Nog steeds in de dip? Kijk omhoog en probeer vandaag wél die bal te raken.",
  "De reeks nederlagen duurt voort. Tijd voor een grondige tactische heroverweging.",
  "Door elke nederlaag zakt je rating sneller dan m'n humeur op persconferenties.",
  "Een diepe dip. De weg omhoog begint vandaag: raak in ieder geval de bal.",
] as const;
const OCHTEND_HYPE = [
  "Je bent niet te stoppen. Doe the rest een lol en verlies eens.",
  "Op deze reeks durf ik geld op je te zetten. Bijna.",
  "De vorm van je leven — geniet ervan zolang het duurt.",
  "Een winreeks! Zelfs de Belgische voetbalbond zou nu overwegen je contract te verlengen.",
  "Winst na winst! Zelfs de Belgische pers begint me nu aardig te vinden door jouw prestaties.",
  "Met zo'n vorm hoeven we in de slotminuten niet eens meer tactisch te wisselen.",
  "Een winreeks! Laat het alsjeblieft niet naar je hoofd stijgen, je bent nog steeds geen El Padelissimo.",
  "Je wint momenteel alles. Heb je stiekem de tegenstander omgekocht met een doos Belgische pralines?",
  "Een winreeks! Je claimt dat je de beste speler bent in de geschiedenis van de club. Zeer Trumpiaanse trekjes.",
  "Je bent onstuitbaar. Zelfs de bondscoach is onder de indruk van je prestaties.",
  "Winst na winst. Mijn notitieboekje raakt vol met louter complimenten.",
  "Een ongekende vorm. Pas op dat je ego de kooi niet doet barsten.",
  "Op deze winreeks mag je best een extra flesje koud zetten.",
  "Je rijgt de zeges aaneen. Heel legaal en heel indrukwekkend.",
  "Groots spel! Zelfs de watersproeiers sproeien vandaag met een feestelijk tintje.",
  "Niet te stoppen. Ik heb je stats zojuist onderstreept in m'n boekje met m'n chique gouden pen.",
  "Dit begint op een ware heerschappij te lijken. De concurrentie trilt al.",
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
  "Vandaag de kooi in. Geen excuses meer over de wind of het racket.",
  "Er wacht een wedstrijd. M'n spiekbriefje ligt in m'n pakzak. Ga ervoor.",
] as const;
const OCHTEND_TOP = [
  "Nummer één. Nu alleen nog zo blijven — de haaien ruiken bloed.",
  "Aan de top is het eenzaam. En glad. Kijk uit voor de watersproeiers.",
  "Nummer één! Probeer er niet af te glijden als de sproeiers op het complex plotseling aangaan.",
  "Bovenaan de ranglijst! Dat voelt bijna net zo goed als een persconferentie na een zwaarbevochten zege.",
  "Nummer één. Geniet ervan, maar onthoud dat één tactische blunder van mij genoeg is om je te banken.",
  "Bovenaan! Zelfs ik begin nu bijna te geloven dat je daadwerkelijk kunt padellen.",
  "Bovenaan het klassement! Heel legaal en heel cool, zoals Trump would say.",
  "Bovenaan de lijst. De jagers zijn al onderweg, dus hou je racket scherp.",
  "De nummer één positie. Een meesterwerk van tactisch vernuft en doorzettingsvermogen.",
  "Koning van het klassement. Iedereen wil je van de troon stoten vandaag.",
  "Bovenaan. Geniet ervan, maar blijf alert.",
  "De troon is heet vandaag. Verdedig hem met hand en tand.",
  "Bovenaan de ladder! De concurrentie kijkt omhoog met knikkende knieën.",
  "Heerser van de club. Mijn notitieboekje glinstert als ik je stats opschrijf.",
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
  "In het grijze midden. Ik ga m'n sportpet er nog niet voor afnemen.",
  "Middenmoot. Ideale uitvalsbasis om stiekem de top-3 te bestormen.",
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
  "Jij bent het roofdier, de koppositie is de prooi. Ga ervoor.",
  "Vlak achter de koploper. M'n notitieboekje staat al in de aanslag voor de machtswisseling.",
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
  "Onderin de tabel. Blijf trainen, the ommekeer begint vandaag.",
  "Op de bodem van de lijst. Zorg dat je vandaag de weg omhoog vindt.",
  "Rode lantaarn. Niet getreurd: er zijn legendarische comebacks begonnen vanaf deze positie.",
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
  "Nieuweling. Laat de concurrentie meteen trillen bij de eerste service.",
  "Blanco statistieken. Een perfecte dag om je eerste stempel te drukken.",
  "Net gestart in het klassement. Onthoud: elke nummer één is ooit onderaan begonnen.",
  "De teller staat nog bijna op nul. Perfecte dag om 'm te laten lopen.",
  "Nieuwkomer. Ik kijk vandaag extra goed mee, met m'n pen in de aanslag.",
  "Net binnengekomen op de lijst. Tijd om je rating serieus te gaan bouwen.",
  "De statistieken zijn nog blanco. Maak er een mooi verhaal van.",
  "Welkom in het klassement. Laat je eerste match direct een statement zijn.",
  "Nog geen historie hier. Die ga je vanaf vandaag zelf schrijven.",
  "De eerste Elo-schattingen zijn binnen. Tijd voor de echte cijfers.",
] as const;

// ── Persoonlijke briefing-varianten (#579) ──────────────────────────────────
// Extra pools die de kale positie-/reekstoon vervangen zodra er iets concreets
// te melden valt: een match tegen je vaste rivaal, een promotie binnen handbereik,
// de Elo-beweging van vandaag, een badge op een haar na, of wisselvallige vorm.
// Placeholders (%rivaal%, %n%, %divisie%, %delta%, %badge%) worden door `vul`
// ingevuld — net als %tier% in coachTierQuip.

/** Vaste rivaal wacht in de volgende match, met een lopende verliesreeks. */
const OCHTEND_RIVAAL = [
  "%rivaal% wacht vandaag. Je verloor de laatste %n% keer — tijd om dat script te scheuren.",
  "Vandaag tegen %rivaal%. %n% keer op rij onderuit; zelfs Infantino zou nu een revanche eisen.",
  "Daar is %rivaal% weer. De teller staat op %n% nederlagen — maak er vandaag een streep doorheen.",
  "%rivaal% op het programma. Je bent %n% keer verslagen; ik heb de wraakplannen al uitgetekend.",
  "Matchdag tegen %rivaal%. Na %n% verliespartijen is het tijd voor een tactische ommekeer van WK-proporties.",
  "Je nemesis %rivaal% staat klaar. %n% keer verloren — vandaag stemmen we die reeks om.",
  "%rivaal% opnieuw. Ik noteerde %n% nederlagen op rij; vandaag wil ik eindelijk een vinkje.",
  "Vandaag treft %rivaal% je weer. %n% keer aan het kortste eind — de statistieken schreeuwen om revanche.",
  "Daar heb je %rivaal%. %n% keer op rij verloren; zelfs mijn geduld begint op te raken.",
  "%rivaal% wacht in de kooi. Na %n% afgangen op rij is er maar één acceptabel resultaat vandaag.",
  "Matchdag, en uitgerekend tegen %rivaal%. %n% nederlagen diep — tijd om de trend te breken.",
  "Je oude bekende %rivaal% staat op de rol. %n% keer verslagen; vandaag draaien we de rollen om.",
  "%rivaal% weer als tegenstander. %n% keer verloren — ik hou m'n gouden pen klaar voor een ander verhaal.",
  "Vandaag: %rivaal%. Die %n% nederlagen op rij? Vergeten we vanaf de eerste service.",
] as const;

/** Promotie naar de volgende divisie ligt binnen handbereik. */
const OCHTEND_PROMOTIE_NABIJ = [
  "Nog %delta% Elo tot %divisie%. Eén zege en ik roep meteen een persconferentie bijeen.",
  "%divisie% ligt op %delta% Elo afstand. Zo dichtbij dat ik m'n sportpet al klaar heb liggen.",
  "Maar %delta% Elo tot %divisie%. Vandaag geen excuses over de wind — dit is te pakken.",
  "Nog %delta% Elo en %divisie% is van jou. Ik heb de promotie-krabbel al half geschreven.",
  "%delta% Elo van %divisie% verwijderd. Eén goede match en we vieren het met een extra persmoment.",
  "Je staat %delta% Elo onder %divisie%. Dat is geen kloof, dat is een aanloopje.",
  "Nog %delta% Elo tot %divisie%. Zelfs Infantino kan deze promotie niet meer tegenhouden.",
  "%divisie% wenkt op %delta% Elo. Ga ervoor, dan hoef ik vanavond niks kritisch te noteren.",
  "Nog %delta% schamele Elo-puntjes tot %divisie%. Ik ruik een historische, Trumpiaanse opmars.",
  "%delta% Elo scheidt je van %divisie%. Vandaag is een uitstekende dag om die streep over te steken.",
  "Bijna %divisie%: nog %delta% Elo. M'n notitieboekje ligt al open op de felicitatiepagina.",
  "Nog %delta% Elo tot %divisie%. Eén overtuigende zege en de promotie is een feit.",
  "%divisie% op %delta% Elo. Zo dichtbij dat de ballenjongens al staan te trappelen om te juichen.",
] as const;

/** Vandaag al Elo gewonnen (cumulatief, voor wie later terugkeert). */
const OCHTEND_DAG_UP = [
  "Vandaag al %delta% Elo verdiend. En de dag is nog jong.",
  "%delta% Elo in de plus vandaag. Ga zo door, m'n gouden pen gloeit al.",
  "Al %delta% Elo winst op de teller vandaag. Dit ruikt naar meer.",
  "Vandaag %delta% Elo gepakt. Ik noteer 't met een tevreden krabbel.",
  "%delta% Elo erbij vandaag. Blijf hameren, de concurrentie kijkt nerveus toe.",
  "Al %delta% Elo omhoog vandaag. Zelfs ik begin bijna te geloven in je tactiek.",
  "Vandaag staat de teller op +%delta% Elo. Een prima basis om op door te bouwen.",
  "%delta% Elo winst tot nu toe. Hou dit vast en de dag wordt legendarisch.",
] as const;

/** Vandaag al Elo verspeeld (cumulatief). */
const OCHTEND_DAG_DOWN = [
  "Vandaag al %delta% Elo verspeeld. Tijd voor een tactische koerswijziging.",
  "%delta% Elo in de min vandaag. Kop op, de dag is nog te redden.",
  "Al %delta% Elo ingeleverd vandaag. Ik heb de rode pen er alvast bij gepakt.",
  "Vandaag %delta% Elo kwijtgeraakt. Eén goede match en we praten er niet meer over.",
  "%delta% Elo eraf vandaag. Zelfs de watersproeiers kijken meewarig toe.",
  "De teller staat op -%delta% Elo vandaag. Tijd om die trend eigenhandig te keren.",
  "Al %delta% Elo verdampt vandaag. Niks dat een overtuigende zege niet oplost.",
  "Vandaag %delta% Elo verloren. M'n notitieboekje kleurt licht rood — herstel dat.",
] as const;

/** Een prestatiebadge ligt op een haar na klaar. */
const OCHTEND_BADGE = [
  "Nog %n% te gaan voor de %badge%. Zó dichtbij dat ik 'm al bijna noteer.",
  "De %badge% ligt op %n% afstand. Eén laatste zetje en hij is binnen.",
  "Nog %n% en de %badge% is van jou. Ik hou de felicitaties klaar.",
  "%badge%: nog %n% te gaan. Dat is geen doel meer, dat is een formaliteit.",
  "Nog %n% voor de %badge%. Vandaag een uitgelezen dag om 'm binnen te harken.",
  "De %badge% wenkt — nog %n% te overbruggen. Ik heb m'n gouden pen in de aanslag.",
  "Nog %n% tot de %badge%. Zo dichtbij dat zelfs ik zenuwachtig word.",
  "%badge% bijna binnen: nog %n%. Maak er vandaag werk van.",
] as const;

/** Wisselvallige vorm: win-verlies-win-verlies. Sneer, dus schild-gevoelig. */
const OCHTEND_WISSELVALLIG = [
  "Win, verlies, win, verlies… kies vandaag eens een kant.",
  "Je vorm hobbelt op en neer als m'n populariteit bij de Belgische pers. Tijd voor stabiliteit.",
  "De ene dag held, de andere pias. M'n notitieboekje raakt in de war van jou.",
  "Om en om winnen en verliezen — dat is geen vorm, dat is een muntworp. Maak er vandaag een lijn van.",
  "Je resultaten zigzaggen alle kanten op. Zelfs mijn tactische bord wordt er duizelig van.",
  "Wisselvallig als het weer boven de kooi. Zorg vandaag voor een sec stukje zon.",
  "Winst, nederlaag, winst, nederlaag. Kies een richting voordat ik er een hoofdstuk over schrijf.",
  "Je vorm is één grote grillige lijn. Vandaag trekken we 'm eindelijk recht.",
] as const;

// Drempels voor de persoonlijke briefing-branches (#579). Geëxporteerd zodat de
// tak-tests er exact op kunnen mikken.
/** Vanaf zoveel onderlinge nederlagen op rij benoemt Rudy de rivaal-match. */
export const RIVAAL_REEKS_MIN = 2;
/** Binnen zoveel Elo tot de volgende divisie geldt promotie als "nabij". */
export const PROMOTIE_DREMPEL = 25;
/** Vanaf deze absolute dag-Elo-beweging is de day-delta het vermelden waard. */
export const DAGDELTA_DREMPEL = 15;
/** Vanaf deze voortgangsratio (nu/doel) is een badge "op een haar na" klaar. */
export const BADGE_NABIJ_RATIO = 0.7;

/** Vervangt %sleutel%-placeholders in een quip (zoals coachTierQuip met %tier%). */
function vul(zin: string, subs: Record<string, string | number>): string {
  let out = zin;
  for (const [k, v] of Object.entries(subs)) out = out.replaceAll(`%${k}%`, String(v));
  return out;
}

/** Wisselvallig = de laatste vier resultaten alterneren strikt tussen W en L. */
function isWisselvallig(vorm: readonly ("W" | "L" | "D")[]): boolean {
  const laatste = vorm.slice(-4);
  if (laatste.length < 4) return false;
  return laatste.every(
    (v, i) => (v === "W" || v === "L") && (i === 0 || v !== laatste[i - 1]),
  );
}

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
  /** Volgende match is tegen je vaste rivaal, met een lopende verliesreeks (#579). */
  rivaalMatch?: { naam: string; verliesreeks: number } | null;
  /** Promotie binnen handbereik: nog `punten` Elo tot `divisie` (#579). */
  promotieNabij?: { divisie: string; emoji: string; punten: number } | null;
  /** Cumulatieve Elo-beweging vandaag; alleen ≠0 nadat je vandaag speelde (#579). */
  dayDelta?: number;
  /** Recente vorm (nieuwste eerst), voor de wisselvallig-detectie (#579). */
  vorm?: readonly ("W" | "L" | "D")[];
  /** Badge op een haar na klaar: nog `doel - nu` te gaan (#579). */
  badgeNabij?: { naam: string; emoji: string; nu: number; doel: number } | null;
  seed: string;
  ctx: RoastCtx;
}

/** Eén regel "Coach Rudy over vandaag" voor bovenaan het dashboard. */
export function coachBriefing(f: BriefingFeiten): string {
  const seed = roastSeed("briefing", f.seed);
  if (f.ctx.schild) return kiesUniek(OCHTEND_NEUTRAAL, seed);
  if (f.losing >= 3) return kiesUniek(OCHTEND_DIP, seed);
  if (f.streak >= 3) return kiesUniek(OCHTEND_HYPE, seed);
  // Match tegen je vaste rivaal met een lopende verliesreeks: persoonlijker dan
  // de generieke matchdag-toon, dus vóór OCHTEND_MATCH.
  if (f.rivaalMatch && f.rivaalMatch.verliesreeks >= RIVAAL_REEKS_MIN) {
    return vul(kiesUniek(OCHTEND_RIVAAL, seed), {
      rivaal: f.rivaalMatch.naam,
      n: f.rivaalMatch.verliesreeks,
    });
  }
  // Promotie binnen handbereik: zeldzaam, dus mag de matchdag-toon overrulen.
  if (f.promotieNabij) {
    return vul(kiesUniek(OCHTEND_PROMOTIE_NABIJ, seed), {
      divisie: `${f.promotieNabij.emoji} ${f.promotieNabij.divisie}`,
      delta: f.promotieNabij.punten,
    });
  }
  if (f.heeftMatch) return kiesUniek(OCHTEND_MATCH, seed);
  // Dag-Elo-beweging: valt in een échte ochtend (nog niet gespeeld) op 0 terug en
  // vuurt dan niet — bedoeld voor wie later op de dag terugkeert.
  if (f.dayDelta != null && Math.abs(f.dayDelta) >= DAGDELTA_DREMPEL) {
    const pool = f.dayDelta > 0 ? OCHTEND_DAG_UP : OCHTEND_DAG_DOWN;
    return vul(kiesUniek(pool, seed), { delta: Math.abs(f.dayDelta) });
  }
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
  // Alleen de middenmoot (en onbekende tier) valt hier door: verrijk 'm met een
  // badge-nudge of een por over wisselvallige vorm vóór de kale ALGEMEEN-pool.
  if (
    f.badgeNabij &&
    f.badgeNabij.doel > 0 &&
    f.badgeNabij.nu / f.badgeNabij.doel >= BADGE_NABIJ_RATIO
  ) {
    return vul(kiesUniek(OCHTEND_BADGE, seed), {
      badge: `${f.badgeNabij.emoji} ${f.badgeNabij.naam}`,
      n: Math.max(1, f.badgeNabij.doel - f.badgeNabij.nu),
    });
  }
  if (!f.ctx.schild && f.vorm && isWisselvallig(f.vorm)) {
    return kiesUniek(OCHTEND_WISSELVALLIG, seed);
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
  "Overwinning binnen! Ik pak m'n sportpet en gooi 'm hoog de lucht in.",
  "Winst! Tactisch gezien een masterclass in omschakelen en domineren.",
  "Punten gepakt! De tegenstander droop met de staart tussen de benen af.",
] as const;
const MATCH_BAGEL = [
  "6-0. Dat is geen wedstrijd, dat is een openbare vernedering. Prachtig.",
  "Een droge 6-0 uitgedeeld — dat getuigt van absolute klasse.",
  "6-0! Een absolute masterclass. Zelfs mijn beste tactische plannen konden deze perfectie niet overtreffen.",
  "Geen enkel game weggegeven. That is pas efficiëntie, daar kan de bond nog wat van leren.",
  "6-0 winst! Dit was bijna net zo makkelijk als een persconferentie na een gewonnen oefenwedstrijd tegen een amateurteam.",
  "6-0! Een absolute afdroging. De tegenstander wist niet eens waar de kooi was.",
  "Een droge 6-0. De definitie van efficiëntie en tactische dominantie.",
  "Bagel uitgedeeld! Zelfs de tegenstanders klapten stilletjes mee.",
  "6-0 winst! Dit was bijna te makkelijk om serieus in m'n boekje te noteren.",
  "Geen game weggegeven. A masterclass in omschakelingspadel.",
  "Met 6-0 gewonnen! Een droge afschminking van historisch niveau.",
  "Bagel op het bord. Efficiënter dan dit wordt het niet, chapeau.",
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
  "Verliespartij... Tijd om m'n pak te laten stomen, want hier werd ik ter plekke misselijk van.",
  "Nederlaag. We analyseren de beelden, al raad ik je aan die met je ogen dicht te bekijken.",
  "Verloren. Tactisch gezien leek het op een mislukte flashmob langs de lijn.",
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
  "Met 0-6 afgedroogd. Ik ga vanavond m'n violen ritueel in brand steken uit frustratie.",
  "Een droge 0-6. Zelfs een getrainde goudvis had vandaag meer ballen over het net gekregen.",
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
  "Remise. Niet gewonnen, niet verloren, gewoon grijs en saai.",
  "Gelijkspel. Zelfs de toeschouwers zijn halverwege naar huis gegaan.",
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

// ── Divisie-wissel: promotie/degradatie toast (#299) ────────────────────────
// %tier% wordt door coachTierQuip vervangen door de nieuwe divisie (bv. "Prof II").
// Promotie = lof: schild blokkeert niet, tempert alleen naar mild (zie coachLof).
// Degradatie = sneer: schild → de neutrale variant.
const TIER_PROMOTIE: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Promotie naar %tier%. Netjes geklommen — dat mag genoteerd.",
    "Welkom in %tier%. Rustig aan verdiend, hou dit niveau vast.",
    "Je stijgt naar %tier%. Een schouderklopje waard, echt.",
    "Opgeklommen naar %tier%. Kleine stap voor de bond, mooie stap voor jou.",
    "%tier% bereikt. Ik zet 'm met een tevreden krabbel in het boekje.",
  ],
  gemeen: [
    "PROMOTIE! %tier% is van jou. Ik roep meteen een persconferentie bijeen.",
    "Je knalt door naar %tier%! Zie je wel dat mijn tactiek werkte.",
    "%tier%! Dit ruikt naar een historische, Trumpiaanse opmars. Enorm.",
    "Gepromoveerd naar %tier%. De ballenjongens juichen, ik juich mee.",
    "Naar %tier% geklommen! Ik krijg spontaan zin in een ererondje.",
    "%tier% bereikt! Snel vastleggen voordat de media er lyrisch over worden.",
  ],
  radioactief: [
    "%tier%!!! De grootste promotie in de geschiedenis van deze padelclub. Absoluut gigantisch.",
    "PROMOTIE naar %tier%! Ik bel Infantino, dit moet in de annalen.",
    "Je katapulteert naar %tier%! M'n tactische bord trilt van pure trots.",
    "%tier% GEHAALD! Champagne op de perstribune, dit vieren we tot in de eeuwigheid.",
    "Opgestegen naar %tier%! Een prestatie van kosmische, radioactieve proporties.",
  ],
};
// Aparte, over-the-top propaganda-toon bij het bereiken van de nieuwe top
// El Padelissimo (#527) — geen %tier%, want dit is een absolute alleenheerser
// zonder sub-niveau. Vervangt de generieke promotieregel voor deze ene tier.
const TIER_PROMOTIE_DICTATOR = [
  "El Padelissimo! Buig voor de Generaal — hij bepaalt vanaf nu de opstellingen, ontslaat de kantinebeheerder en annexeert de kooi ernaast. 🫡",
  "EL PADELISSIMO! De baan heeft een dictator. Tegenstanders worden per direct uit de groepsapp verwijderd en begroeten je voortaan met een saluut. 🫡",
  "Machtsovername voltooid: El Padelissimo. Je bent geen speler meer maar de sportief directeur — de kooi is nu een dictatuur en jij regeert. 🫡",
  "El Padelissimo bereikt! Ik roep het uit tot staatsfeestdag. De vlaggen gaan uit, je standbeeld in de kantine wordt onthuld. 🫡",
  "De troon is bezet: El Padelissimo. Van GOAT naar Generaal — wie tegen je speelt, pakt beter meteen de koffers. 🫡",
  "El Padelissimo! Net als Kylian bepaal jij vanaf nu de transfertargets en wie er überhaupt de club binnenkomt. 🫡",
  "EL PADELISSIMO! De ultieme dictator. Je hebt de volledige controle en veto't elke wissel langs de lijn. 🫡",
] as const;
const TIER_DEGRADATIE: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Je zakt naar %tier%. Gebeurt de besten — al gebeurt het jou opvallend vaak.",
    "Degradatie naar %tier%. Kop op, van hieruit kan het weer omhoog.",
    "Terug naar %tier%. Niet getreurd, blijven oefenen. Veel oefenen.",
    "%tier%, daar zit je weer. Morgen is er weer een klassement.",
    "Een stapje terug naar %tier%. Zie het als een aanloopje.",
  ],
  gemeen: [
    "Gedegradeerd naar %tier%. Ik noteer 'm, met een diepe zucht.",
    "Je glijdt af naar %tier%. Lag het aan de wind, de bal of de tactiek? Weer niet.",
    "Terug naar %tier%. Zelfs de watersproeiers keken beschaamd de andere kant op.",
    "%tier%, welkom terug. Ik had dit hoofdstuk liever niet geschreven.",
    "Weggezakt naar %tier%. Tijd voor een strafronde en een tactische heroverweging.",
    "Afgezakt naar %tier%. Mijn spiekbriefje ligt in scherven op de kleedkamervloer.",
  ],
  radioactief: [
    "Gekelderd naar %tier%! Een vrije val van WK-proporties. Ongezien.",
    "%tier%?! We vechten dit aan bij Infantino. Dit klassement is corrupt, rigged!",
    "Afgestort naar %tier%. Ik trek m'n pet diep over m'n ogen van pure gêne.",
    "Verbannen naar %tier%! Ik overweeg per direct m'n coachlicentie in te leveren.",
    "%tier%. Een degradatie zo pijnlijk dat ik 'm het liefst uit de database wis.",
  ],
};
const TIER_DEGRADATIE_NEUTRAAL = [
  "Je zakt naar %tier%. Volgende keer pak je hem terug.",
  "Degradatie naar %tier% genoteerd. Op naar de weg omhoog.",
  "Terug naar %tier%. Een nieuwe klim om aan te beginnen.",
  "%tier% — de stand van nu. De volgende matches bepalen de rest.",
] as const;

export interface TierFeiten {
  richting: "promotie" | "degradatie";
  /** Label van de nieuwe divisie (wissel.naar.label), vult %tier%. */
  tierLabel: string;
  /** Kleur-/tokensleutel van de nieuwe divisie (wissel.naar.key). Voedt de
   *  dictator-special-case bij promotie naar El Padelissimo (#527). */
  naarKey?: TierKey;
  seed: string;
  ctx: RoastCtx;
}

/** Coach-quip voor de toast bij een divisie-promotie/-degradatie (#299). */
export function coachTierQuip(f: TierFeiten): string {
  const seed = roastSeed("tier-toast", f.seed, f.richting);
  let zin: string;
  if (f.richting === "promotie" && f.naarKey === "dictator") {
    // Eigen propaganda-regel bij het bereiken van de nieuwe top (#527); het
    // roast-schild tempert de toon niet — een staatsgreep viert iedereen mee.
    zin = kiesUniek(TIER_PROMOTIE_DICTATOR, seed);
  } else if (f.richting === "promotie") {
    // Lof: schild blokkeert niet, tempert alleen tot mild.
    zin = kiesUniek(TIER_PROMOTIE[f.ctx.schild ? "mild" : f.ctx.intensiteit], seed);
  } else if (f.ctx.schild) {
    zin = kiesUniek(TIER_DEGRADATIE_NEUTRAAL, seed);
  } else {
    zin = kiesUniek(TIER_DEGRADATIE[f.ctx.intensiteit], seed);
  }
  return zin.replace("%tier%", f.tierLabel);
}

// ── Winst-/verliesreeks-mijlpaal: 3/5/10 toast (#300) ───────────────────────
// %n% wordt door coachStreakQuip vervangen door het reekscijfer (3, 5 of 10).
// De toon loopt op mét de mijlpaal (3 < 5 < 10), niet met de groep-intensiteit:
// een reeks is globaal (over alle groepen), dus er is geen groepstoon — net als
// bij de tier-toast (#299). Winst = lof: schild blokkeert niet. Verlies = sneer:
// schild → de neutrale variant.
export const STREAK_MIJLPALEN = [3, 5, 10] as const;
export type StreakMijlpaal = (typeof STREAK_MIJLPALEN)[number];

const STREAK_WINST: Record<StreakMijlpaal, readonly string[]> = {
  3: [
    "Drie op een rij. Netjes — dat noteer ik met een tevreden krabbel.",
    "%n% zeges achter elkaar. De vorm zit erin, hou 'm vast.",
    "Drie keer raak op rij. Geen toeval meer, dit heet een reeks.",
    "%n% op een rij gewonnen. Rustig doorbouwen, ik hou het bij.",
    "Een winreeks van %n%. Chapeau — en dat zeg ik niet snel.",
  ],
  5: [
    "VIJF op een rij! Ik heb er al een halve pagina bejubelend over volgeschreven.",
    "%n% zeges aan één stuk! Zo won ik bij Lille in 2011 óók nooit.",
    "Vijf op rij! De ballenjongens beginnen jouw naam te scanderen.",
    "Een reeks van %n%! Ik roep hier bijna een persconferentie voor bijeen.",
    "%n% keer op rij gewonnen! Dit ruikt naar een historische, Trumpiaanse opmars.",
  ],
  10: [
    "TIEN OP EEN RIJ! De grootste reeks in de geschiedenis van deze padelclub. Gigantisch.",
    "%n% zeges aan één stuk! Ik bel Infantino, dit moet op de Werelderfgoedlijst.",
    "Tien op rij! Ik laat je naam op m'n onderarm zetten. Definitief.",
    "Een reeks van %n%?! Champagne op de perstribune, dit vieren we tot in de eeuwigheid.",
    "%n% keer raak op rij! Een prestatie van kosmische, radioactieve proporties.",
  ],
};
const STREAK_VERLIES: Record<StreakMijlpaal, readonly string[]> = {
  3: [
    "Drie nederlagen op rij. Gebeurt de besten — al gebeurt het jou opvallend vaak.",
    "%n% keer verloren aan één stuk. Misschien die forehand eens meenemen?",
    "Drie op rij de boot in. Niet getreurd, blijven oefenen. Veel oefenen.",
    "Een verliesreeks van %n%. Op papier vast een tactisch meesterwerk.",
    "%n% keer op rij onderuit. Morgen is er weer een dag, en hopelijk een andere tactiek.",
  ],
  5: [
    "Vijf nederlagen op rij. Zelfs het publiek keek collectief weg.",
    "%n% keer verloren aan één stuk. Trainen, gij. Dringend.",
    "Vijf op rij de deksel op de neus. Je partner verdient na vandaag een standbeeld.",
    "Een verliesreeks van %n%. Net zo kansloos als België tegen Spanje op het WK.",
    "%n% keer op rij onderuit. Ik heb er drie pagina's over volgeschreven, allemaal met uitroeptekens.",
  ],
  10: [
    "TIEN nederlagen op rij. Als falen een olympische discipline was, stond je nu op het podium.",
    "%n% keer verloren aan één stuk. Heb je na vandaag al eens serieus aan curling gedacht?",
    "Tien op rij onderuit. Ik zou dat racket per direct bij het grofvuil zetten. Definitief.",
    "Een verliesreeks van %n%?! Ik trek m'n coach-pet diep over m'n ogen van pure gêne.",
    "%n% keer op rij de boot in. Ik overweeg serieus m'n licentie in te leveren en schaapherder te worden.",
  ],
};
// Schild aan → geen sneer, maar een zachte, motiverende variant.
const STREAK_VERLIES_NEUTRAAL: Record<StreakMijlpaal, readonly string[]> = {
  3: [
    "Drie nederlagen op rij. De volgende match keert het tij.",
    "%n% keer verloren. Kop op, van hieruit kan het weer omhoog.",
    "Een reeks van %n% verliezen. Blijven spelen — vorm komt en gaat.",
  ],
  5: [
    "Vijf op rij verloren. Een reeks om te doorbreken; de volgende is de jouwe.",
    "%n% nederlagen op een rij. Kop op, elke reeks eindigt een keer.",
    "Een verliesreeks van %n%. Op naar een frisse start volgende match.",
  ],
  10: [
    "Tien op rij verloren. Zwaar, maar zelfs de langste reeks eindigt een keer.",
    "%n% nederlagen aan één stuk. Op naar een frisse start; het tij keert.",
    "Een reeks van %n%. Diep punt — van hieruit kan het alleen maar omhoog.",
  ],
};

export interface StreakFeiten {
  richting: "winst" | "verlies";
  /** De geraakte mijlpaal (3, 5 of 10), vult %n%. */
  mijlpaal: StreakMijlpaal;
  seed: string;
  ctx: RoastCtx;
}

/** Coach-quip voor de toast op een winst-/verliesreeks-mijlpaal (3/5/10) (#300).
 *  Winst = lof: het schild blokkeert niet. Verlies = sneer: schild → neutraal. */
export function coachStreakQuip(f: StreakFeiten): string {
  const seed = roastSeed("streak-toast", f.seed, f.richting, String(f.mijlpaal));
  let zin: string;
  if (f.richting === "winst") {
    zin = kiesUniek(STREAK_WINST[f.mijlpaal], seed);
  } else if (f.ctx.schild) {
    zin = kiesUniek(STREAK_VERLIES_NEUTRAAL[f.mijlpaal], seed);
  } else {
    zin = kiesUniek(STREAK_VERLIES[f.mijlpaal], seed);
  }
  return zin.replace("%n%", String(f.mijlpaal));
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
  "Underdog? Dat betekent dat we de tactiek van de totale verrassing gaan toepassen.",
  "Je kansen zijn klein, maar de legende van de outsider is springlevend.",
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
  "Torenhoge favoriet. Als je dit verliest, schrijf ik drie pagina's met pure frustratie in m'n boekje.",
  "Iedereen rekent op jou. Zorg dat je de kooi met opgeheven hoofd verlaat.",
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
  "Fiftyfifty. Een uitstekende kraker om te bewijzen wie tactisch het best onderlegd is.",
  "Twee teams die aan elkaar gewaagd zijn. Dit wordt een schaakspel in de kooi.",
] as const;

// ── Pre-match head-to-head (#581): de rivaliteit met de tegenstander ─────────
// Krijgt voorrang op de kale kansentaal als er een duidelijk verhaal is:
// een lopende verliesreeks (angstgegner), of een scheve onderlinge balans.
// %rivaal% = naam tegenstander, %n% = verliesreeks, %saldo% = |balans|.

/** Je verliest al ≥ RIVAAL_REEKS_MIN keer op rij van deze tegenstander. */
const PRE_H2H_ANGST = [
  "%rivaal% is je angstgegner: %n% keer op rij verloren. Vandaag breek je die vloek.",
  "Je verloor de laatste %n% van %rivaal%. Tijd om dat script eindelijk te scheuren.",
  "%rivaal% zit diep in je hoofd — %n% nederlagen op rij. Toon lef vandaag.",
  "%n% keer achter elkaar onderuit tegen %rivaal%. Zelfs ik word er nerveus van; draai het om.",
  "Daar is %rivaal% weer, je nachtmerrie. %n% keer op rij verslagen — nu of nooit.",
  "%rivaal% pakt je telkens: %n% op rij. Ik heb een speciaal tactisch plan (het staat op een servetje).",
  "Tegen %rivaal% verlies je al %n% keer op een rij. Vandaag geen alibi's meer.",
  "%n% nederlagen op rij tegen %rivaal%. De statistieken smeken om een ommekeer.",
] as const;

/** Je leidt de onderlinge balans tegen deze tegenstander. */
const PRE_H2H_BAAS = [
  "%rivaal% verslaat je zelden — je staat %saldo% voor. Bevestig dat op de baan.",
  "Tegen %rivaal% ben jij de baas (%saldo% voorsprong). Nu niet verslappen.",
  "Je hebt %rivaal% meestal in je zak: %saldo% in de plus. Hou die reputatie hoog.",
  "%rivaal% is jouw prooi — %saldo% duels voor. Ik noteer graag nog een streepje.",
  "In de onderlinge stand leid je op %rivaal% met %saldo%. Verpest het nu niet.",
  "Je domineert %rivaal% (%saldo% voorsprong). Voeg er vandaag een zege aan toe.",
  "%saldo% duels voorsprong op %rivaal%. Speel als de favoriet die je onderling bent.",
  "%rivaal% kan je zelden aan: %saldo% in jouw voordeel. Maak het af.",
] as const;

/** Je staat achter in de onderlinge balans (maar geen actuele verliesreeks). */
const PRE_H2H_ACHTER = [
  "In de onderlinge stand kijk je tegen %rivaal% omhoog (%saldo% achter). Tijd om in te lopen.",
  "%rivaal% heeft de betere papieren tegen jou: %saldo% achterstand. Werk aan de winkel.",
  "Je staat %saldo% achter op %rivaal%. Vandaag een uitgelezen kans om bij te trekken.",
  "Tegen %rivaal% trek je meestal aan het kortste eind (%saldo% achter). Draai de trend.",
  "De balans met %rivaal% helt de verkeerde kant op (%saldo%). Zet dat recht.",
  "%rivaal% leidt jullie onderlinge duel met %saldo%. Knok je terug in de stand.",
  "Je hebt een %saldo%-achterstand op %rivaal%. Perfecte dag om te beginnen met inhalen.",
  "%rivaal% is je nét de baas (%saldo% voor). Bewijs dat het anders kan.",
] as const;

/** Onderling H2H-feit voor de pre-match hype (#581), vanuit jóuw perspectief. */
export interface PreMatchH2H {
  /** Naam van de tegenstander/rivaal. */
  rivaal: string;
  /** Onderlinge zeges van jou en van de rivaal. */
  mijnWins: number;
  oppWins: number;
  /** Lopende onderlinge verliesreeks (≥ 0). */
  verliesreeks: number;
}

/** Korte hype/waarschuwing bij een geplande match, op basis van de winkans
 *  (0..1) van jóuw team. Met een H2H-feit (#581) krijgt de rivaliteit voorrang
 *  op de kale kansentaal; zonder duidelijk verhaal valt hij terug op de winkans. */
export function coachPreMatch(
  winkans: number,
  seed: string,
  ctx: RoastCtx,
  h2h?: PreMatchH2H | null,
): string {
  const s = roastSeed("prematch", seed);
  if (ctx.schild) return kiesUniek(PRE_NEUTRAAL, s);
  if (h2h) {
    const saldo = Math.abs(h2h.mijnWins - h2h.oppWins);
    if (h2h.verliesreeks >= RIVAAL_REEKS_MIN) {
      return vul(kiesUniek(PRE_H2H_ANGST, s), { rivaal: h2h.rivaal, n: h2h.verliesreeks });
    }
    if (h2h.mijnWins > h2h.oppWins) {
      return vul(kiesUniek(PRE_H2H_BAAS, s), { rivaal: h2h.rivaal, saldo });
    }
    if (h2h.oppWins > h2h.mijnWins) {
      return vul(kiesUniek(PRE_H2H_ACHTER, s), { rivaal: h2h.rivaal, saldo });
    }
    // Gelijke stand zonder verliesreeks → geen sterk verhaal; val terug op winkans.
  }
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
  "De padelkooi roept! Tijd om die eerste match te registreren.",
  "Blanco statistieken wachten op jouw eerste legendarische rally.",
] as const;

const EMPTY_WELKOM = [
  "Welkom in de wereld van Padel Klassement! Speel je eerste match en ontdek je niveau.",
  "Leuk dat je er bent! Tijd om te laten zien wat je in huis hebt.",
  "Nieuw hier? Geen zorgen — iedereen begon ooit met nul matches en oneindig potentieel.",
  "Welkom! De eerste stap is altijd de zwaarste. De tweede is: match loggen.",
  "Fijn dat je meedoet. Nu nog even een tegenstander regelen...",
  "Je account is klaar. Nu nog de rest van de wereld verslaan.",
  "Welkom! De banen liggen er strak bij, tijd om je niveau te bepalen.",
  "Leuk dat je er bent. Laten we die rating eens een vliegende start geven.",
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
  "Welkom! Nul gespeeld, dus statistisch gezien nog nul tactische flaters begaan. Een perfecte start.",
  "Nieuwe speler gedetecteerd. M'n notitieboekje heeft direct een blanco pagina voor je gereserveerd.",
] as const;

const EMPTY_GROUP = [
  "Deze groep is nog leeg als een net geopend blik. Nodig vrienden uit!",
  "Een groep zonder leden is als een padelbaan zonder net. Tijd om dat te fixen.",
  "Jij bent de eerste! Nodig je speelmaatjes uit om de competitie te starten.",
  "Een groep met één lid is technisch gezien een solo-act. Laten we dat veranderen.",
  "Deze groep wacht op jouw vrienden. Deel die invite-link!",
  "Eenzaam aan de top? Nodig anderen uit om je van je troon te stoten.",
  "Een lege groep... Tijd om je padelmaten uit te nodigen voor een stevige competitie.",
  "De kooi is leeg zonder tegenstanders. Deel de uitnodigingslink!",
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
