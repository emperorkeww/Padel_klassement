// Coach Rudy over jouw plek in het klassement (#411): pools + deterministische
// generator voor de Leaderboard-pagina. De tier (troon / jager / middenmoot /
// kelder / nieuw) kiest de pool, concrete klassement-feiten (Elo-gat naar de
// buurman, afstand tot de top-3, sprong-grootte) vullen waar mogelijk een
// geïnterpoleerde feit-regel in (patroon: de feit-bouwers in coachFeed.ts), en
// het contrast tussen groep en globaal is de sappigste regel van allemaal —
// koning van je vriendengroep maar #40 van de app is een grap die zichzelf
// schrijft. Alleen de kelder is echte spot: die pool schaalt per intensiteit
// (≥12 regels per niveau, conventie roastTone.test.ts) en het roast-schild
// tempert hem tot een neutrale variant; troon, jager en nieuw zijn lof of
// neutraal en blijven ook mét schild spreken (analoog aan coachLof). Puur en
// deterministisch via roastSeed; getest in klassementPraat.test.ts.

import type { CoachMood, RoastCtx, RoastIntensiteit } from "@/features/coach/roastTone";
import { kiesUniek, roastSeed } from "@/features/coach/roastTone";
import { JAGER_GAT, type KlassementFeiten } from "@/features/coach/klassementFeiten";

export interface KlassementCommentaarInvoer {
  /** Feiten van het klassement dat op het scherm staat (groep of globaal). */
  feiten: KlassementFeiten;
  /** Globale feiten voor het contrast wanneer de scope "groep" is; anders weglaten. */
  globaal?: KlassementFeiten | null;
  groepsNaam?: string | null;
  /** Bv. `${playerId}|${groupId || "globaal"}|${dagISO}` — per dag en scope stabiel. */
  seed: string;
  /** Intensiteit van het oppervlak + schild van de kijker (die is het doelwit). */
  ctx: RoastCtx;
}

export const TROON = [
  "Nummer één van het klassement. Ik heb je naam met hoofdletters in m'n notitieboekje gezet.",
  "De troon is van jou. Hou 'm warm, want iedereen daaronder slijpt de messen.",
  "Bovenaan. Dit is het uitzicht waar ik het als bondscoach altijd over had.",
  "De nummer één. Ik neem m'n pet voor je af, en dat is bij mij een échte pet.",
  "Helemaal bovenaan. Zelfs Infantino zou dit klassement volkomen legitiem noemen.",
  "De koppositie. Geniet ervan zolang de watersproeiers uitstaan.",
  "Nummer één van de lijst. Ik overweeg er een persconferentie voor bijeen te roepen.",
  "De top of het klassement. Vanaf hier kun je alleen nog vallen — maar wát een uitzicht.",
  "Jij bent de maatstaf. De rest speelt om de tweede plek, of ze het toegeven of niet.",
  "Eerste plaats in het klassement. Heel legaal, heel cool. Iedereen zegt het.",
  "De leider van het peloton. Niet omkijken, daar word je alleen maar zenuwachtig van.",
  "Bovenaan de lijst. Ik heb er een gouden sticker bij geplakt in m'n notitieboekje.",
  "Op de troon. M'n notitieboekje glinstert als ik je stats opschrijf.",
  "De heerser van de ranglijst. De concurrentie kijkt omhoog met knikkende knieën.",
  "Bovenaan. Dat is de natuurlijke orde der dingen, althans voor jou op dit moment.",
  "Koning van de baan. Nu nog een scepter regelen om de rest in het gareel te houden.",
  "Nummer één. Zelfs de bondscoach kan hier geen kritische noot over kraken.",
  "Bovenaan de lijst. Een prestatie van historische omvang. The greatest, absolute class.",
  "Koning van het klassement. De jagers liggen op de loer, maar jij zit comfortabel.",
  "Eerste plek. M'n spiekbriefjes waren blijkbaar goud waard voor jouw positionering.",
  "De onbetwiste leider. Zorg dat je de troonopvolger op gepaste afstand houdt.",
  "De absolute top. Ik heb een gouden krabbel bij je Elo gezet.",
  "Bovenaan de voedselketen. De rest van de club kijkt omhoog met knikkende knieën.",
  "Nummer één. De spotlights staan volledig op jou gericht vandaag.",
  "Koning van de ranking. Laat ze maar komen, die jagers.",
] as const;

export const JAGER = [
  "Podiumplek, maar geen troon. Je ademt in de nek van de nummer één — nu nog toehappen.",
  "Zo dicht bij de top dat je 'm kunt ruiken. Rondje jagen, zou ik zeggen.",
  "De eerste achtervolger. Eén goede week en dat klassement kantelt.",
  "Jager in het klassement. De nummer één slaapt al onrustig, hoor ik.",
  "Bijna bovenaan. Tijd voor een gedurfde wissel: meer matches, minder excuses.",
  "De top-3. Netjes. Maar zilver en brons zijn voor de geschiedenisboeken van others.",
  "Je staat te loeren op de koppositie. Ik heb de hinderlaag al uitgetekend in m'n notitieboekje.",
  "De achtervolging is ingezet. Dit is het soort spanning waar ik persconferenties voor uitvond.",
  "Vlak achter de leider. Eén tactisch meesterplan van mij en die troon is van jou.",
  "Top-3! Nu niet tevreden achteroverleunen — dat is iets voor de middenmoot.",
  "Zo hoog geklommen dat de nummer één je hoort hijgen. Muziek in mijn oren.",
  "De sprong naar de top is nog maar één sprintje. Ik heb de bidons al klaargezet.",
  "Op jacht naar de troon. De koploper voelt de hete adem al in z'n nek blazen.",
  "Achtervolger van dienst. Houd je racket scherp, de top is dichtbij.",
  "De tweede plek is leuk, maar de eerste is waar de geschiedenis geschreven wordt.",
  "Je staat op scherp om de troon te bestormen. M'n notitieboekje ligt al open.",
  "Vlak achter de koploper. Eén misstap van de nummer één en jij pakt de kroon.",
  "In de slipstream van de leider. Tijd om de turbo aan te zetten.",
  "Zilveren positie. Eén tactische eindsprint en de troon is voor jou.",
  "De koploper hoort je stappen al weerklinken op de baan. Blijf jagen!",
  "Niet ver van de troon. M'n notitieboekje trilt van de spanning.",
  "Achtervolger op scherp. Eén match en het hele klassement ligt overhoop.",
  "De top-3 is binnen handbereik, nu die koppositie nog opeisen.",
  "Je loert op de eerste plek. Focus op die zwakke forehand van de leider.",
  "Bijna de koning. Blijf rennen, de troon is dichtbij.",
] as const;

export const MIDDENMOOT = [
  "Keurig in de middenmoot van het klassement. Veilig, grijs en volstrekt onbesproken.",
  "De middenmoot. Niet slecht genoeg voor m'n notitieboekje, niet goed genoeg voor m'n pet.",
  "Middenin het klassement. De top ziet je niet, de kelder ook niet. Missie geslaagd?",
  "Anoniem in het midden. Zelfs de statistieken moeten twee keer kijken wie je ook alweer was.",
  "De gulden middenweg, noemen ze dat. Ik noem het: nog alles te bewijzen.",
  "Stabiel in het midden. Stabiliteit is mooi voor bruggen, minder voor sporters.",
  "Middenmoot. Vanaf hier kun je twee kanten op, en ik weet welke kant ik zou kiezen.",
  "Het comfortabele midden. Comfort is de vijand van elke rasechte kampioen.",
  "Niet vooraan, niet achteraan. De perfecte camouflage — maar ik zie je wél.",
  "Middenin de lijst. Tijd om iemand boven je van z'n voetstuk te meppen.",
  "Het maakt niet uit hoe ik het klassement draai: jij blijft in het midden staan.",
  "Middenmoot. In m'n notitieboekje staat bij jouw naam: 'kan meer, doet minder'.",
  "Grijs en anoniem in het midden. Precies de plek waar je geen vijanden maakt, maar ook geen indruk.",
  "Middenmoot. Zelfs de supporters zijn vergeten in welke divisie je eigenlijk speelt.",
  "Veilig tussen de top en de kelder. Een beetje extra pit kan geen kwaad.",
  "De comfortzone van de ranglijst. Maar comfort brengt je niet op het podium.",
  "Stabiel op de gemiddelde ranking. Niet goed, niet rampzalig, gewoon... aanwezig.",
  "In het midden van het pak. De ideale positie om geruisloos naar boven te sluipen.",
  "Vastgeroest in het midden. Tijd om die spieren te smeren en omhoog te klauteren.",
  "In het veilige hart van de tabel. Maar de koplopers liggen nog binnen bereik.",
  "Comfortabel tussen de haaien en de slachtoffers in.",
  "Middenmoot. Precies de plek waar we geen persconferenties over houden.",
  "Stabiel in het grijze midden. Tijd om die spieren te spannen en te stijgen.",
  "Niet goed genoeg voor lof, niet slecht genoeg voor een roast. Grijs.",
  "In het hart van de tabel. Veilig en anoniem.",
] as const;

export const MIDDENMOOT_NEUTRAAL = [
  "Middenin het klassement. De volgende match kan je een plek omhoog duwen.",
  "Een stabiele plek in het midden van de lijst.",
  "Middenmoot. Alles boven je is haalbaar met een paar goede weken.",
  "Netjes in het midden. Het klassement ligt nog helemaal open.",
  "Stabiel in het midden. Elke match is een kans om te klimmen.",
  "In de middenmoot. De ranglijst is nog volop in beweging.",
  "Middenmoot. Iedere match is een kans om de top-3 te naderen.",
  "Stabiel op je vertrouwde plek in de ranglijst.",
  "Een stabiele positie. Klaar voor de volgende stap.",
  "Middenmoot — de perfecte uitvalsbasis voor een klim.",
  "In het hart van de tabel. De volgende weken kunnen veel veranderen.",
  "Een stabiele positie. Elke overwinning brengt je dichter bij de top.",
  "Netjes in het midden. Focus op de looplijnen voor een sprong omhoog.",
  "Middenmoot. Blijf stijgen door consistent je matches te winnen.",
  "Een rustige, stabiele plek in het klassement. De weg ligt open.",
] as const;

export const NIEUW = [
  "Nieuw in het klassement. Ik heb een verse bladzijde voor je aangebroken in m'n notitieboekje.",
  "Te weinig matches voor een oordeel. Zelfs ik roast niet op basis van een halve statistiek.",
  "Net binnen. Speel een paar potten, dan vertelt de ranglijst wie je écht bent.",
  "Je rating is nog aan het opwarmen. Net als m'n oordeel.",
  "Verse cijfers, blanco reputatie. Dat duurt precies een paar matches, dus geniet ervan.",
  "Nieuw op de lijst. De statistieken kennen je nog niet, maar dat komt vanzelf — goedschiks of kwaadschiks.",
  "Nog te weinig gespeeld voor een plek met betekenis. De baan wacht.",
  "Je Elo is voorlopig een schatting. Mijn nieuwsgierigheid is dat niet.",
  "Elke legende begint onderaan een lijstje. Elke flop trouwens ook. Aan jou de keuze.",
  "Ik heb nog geen mening over je. Koester dit moment, het is eenmalig.",
  "Net gestart. Zelfs Infantino kan hier nog niks van vinden.",
  "De teller loopt nog. Kom terug na een paar matches, dan praten we klassement.",
  "Net binnengestroomd. De gevestigde orde kijkt argwanend naar je rating.",
  "Een onbeschreven blad. M'n pen staat klaar om je eerste successen (of drama's) te noteren.",
  "Vers bloed in het klassement. Laat maar zien wat je in huis hebt.",
  "Elo-rating in de opwarmfase. We zijn benieuwd waar het schip strandt.",
  "De nieuwe uitdager. Speel snel meer matches, m'n notitieboekje raakt ongeduldig.",
  "Nieuweling op de ranglijst. De banen wachten op je eerste echte statement.",
  "Nieuwe speler, nieuwe rating. De kooi wacht op je definitieve stempel.",
  "Net op de lijst gezet. Laten we die rating eens snel een richting op sturen.",
  "Vers bloed. De concurrentie kijkt argwanend naar je eerste cijfers.",
  "Nieuwe speler. Ik heb de pen al geslepen voor je eerste echte pot.",
  "Net gestart. Laat ze direct zien dat je niet gekomen bent om te banken.",
  "Wit blad in m'n notitieboekje. Schrijf je eigen geschiedenis.",
  "Rating in opbouw. De baan wacht op je eerste statement.",
  "Net geregistreerd op de lijst. Laten we die rating eens snel opschudden.",
  "Een frisse uitdager. Speel meer matches om je ware niveau te bewijzen.",
  "Met een blanke lei beginnen in de ranking. Speel de kooi in!",
  "Nieuw gezicht in de tabel. De concurrentie houdt je in de gaten.",
  "Net binnen. Tijd om te laten zien dat je niet gekomen bent voor de reservebank.",
] as const;

/** De kelder is de enige echte roast op deze pagina, dus de enige pool die per
 *  intensiteit schaalt. Plagen, geen kwetsen: over de positie, nooit de persoon. */
export const KELDER: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Onderin het klassement. Iemand moet het doen, maar het hoeft niet permanent te zijn.",
    "De kelder. Daar staat tenminste het bier koud, zeggen ze.",
    "Onderaan de lijst. Kop op: vanaf hier is elke richting vooruitgang.",
    "De rode lantaarn. Draag 'm met waardigheid, en geef 'm dan snel door.",
    "Onderin. Het fundament van het klassement, zeg maar. Iemand moet het dragen.",
    "De onderste regionen. M'n notitieboekje heeft een zachte pagina voor je vrijgehouden.",
    "Laag in het klassement. Niks dat drie goede matches niet kunnen rechttrekken.",
    "De kelderklasse van de lijst. Gezellig is het er wel, hoor ik.",
    "Onderaan. Zie het als een aanloop: hoe dieper je zakt, hoe langer de sprint omhoog.",
    "De achterhoede. Zelfs daar hou ik een oogje in het zeil, dat beloof ik.",
    "Onderin de tabel. De sproeiers staan daar zachter afgesteld, dat scheelt.",
    "De laatste linie van het klassement. Verdedig die plek niet te fanatiek.",
    "Onderaan de ladder. Gelukkig is de weg omhoog de enige optie.",
    "Hekkensluiter voor nu. Geen paniek, blijf trainen en de punten komen vanzelf.",
    "In de kelder. Een prima plek om in alle rust aan je forehand te schaven.",
    "Laag geklasseerd. Maar herinner je: elke legende begon ooit onderaan.",
    "Het klassement sluiten is ook een verantwoordelijkheid. Maar geef die snel door.",
    "Onderin de tabel. Ideaal om de concurrentie van onderaf te verrassen.",
    "De onderste plek. Zie het als een tactische aanloop.",
    "De kelder. Maar wees gerust, de weg omhoog is de enige optie.",
    "Rode lantaarn. Blijven lachen, trainen en die forehand poetsen.",
    "Laag in het klassement. Drie goede potten en je bent er weer uit.",
    "De kelderklasse. Gezellig is het er wel, hoor ik.",
    "Onderaan de ladder. Blijf trainen en de weg omhoog verschijnt vanzelf.",
    "Laag geklasseerd, maar het seizoen is gelukkig nog heel lang.",
    "De rode lantaarn is tijdelijk. Pak dat racket en klim eruit.",
    "Laag in de tabel. Alle kansen liggen open voor een flinke inhaalslag.",
    "Onderin. Ideaal om zonder druk aan je techniek te schaven.",
  ],
  gemeen: [
    "De kelder van het klassement. Ik heb er een aparte pagina voor in m'n notitieboekje: 'zorgenkindjes'.",
    "Onderaan. Het klassement is genadeloos eerlijk, en vandaag wijst het naar jou.",
    "De rode lantaarn brandt fel. Zelfs vanuit m'n chique pak langs de lijn is het pijnlijk om te zien.",
    "Onderin the lijst. De statistieken vertellen geen sprookje, en dit is geen sprookje.",
    "Hekkensluiter. Op het WK noemden we dat 'de groepsfase niet overleven'.",
    "De kelder. Zelfs de zwaartekracht vindt dat je nu wel diep genoeg zit.",
    "Onderaan het klassement. De bookmakers hebben je afgeschreven, ik nog nét niet.",
    "De onderste plek van de lijst is officieel bezet. Gefeliciteerd, denk ik?",
    "Onderin. Dit vraagt om een gedurfde wissel in de 89e minuut — jammer dat je jezelf niet kunt wisselen.",
    "De achterhoede van het klassement. M'n denkbeeldige viool staat al klaar.",
    "Zo laag in de tabel dat de degradatiestreep boven je hangt als een onweerswolk.",
    "De kelder. Trainen, gij. Dringend en veel.",
    "In de diepe kelder. Ik heb een aparte rode stift gekocht voor je klassementspositie.",
    "Onderaan de lijst. Zelfs de Romeinse pers had hier geen goed woord voor over.",
    "Degradatiezone. M'n denkbeeldige viool speelt een heel melancholisch lied voor je.",
    "Hekkensluiter. Zelfs met een viervoudige wissel in de 89e minuut is hier geen eer aan te behalen.",
    "Onderaan het klassement. De bookmakers geven geen cent meer voor je titelkansen.",
    "De rode lantaarn is stevig in jouw handen. Hopelijk is de batterij snel leeg.",
    "Degradatiezone. M'n viool staat al gestemd in mineur.",
    "Onderaan. Mijn notitieboekje heeft een rode stift gereserveerd voor je stats.",
    "Kelderbewoner. Trainen, gij. Dringend en veel.",
    "Hekkensluiter. Zelfs met Infantino aan de lijn is hier geen redden aan.",
    "De onderste regionen. Dit tactisch debacle vraagt om zware sancties.",
    "Zelfs een slak met rugklachten en tegenwind klimt momenteel sneller op de ladder dan jouw rating.",
    "Onderaan het klassement. De tegenstander stuurt je vanavond een bedankkaartje voor de gratis Elo.",
    "De kelder is koud en tochtig, maar jouw vorm is vandaag nog een flink stuk onder het vriespunt gezakt.",
    "Rode lantaarn. Mijn spiekbriefjes en tactische notities bieden helaas geen EHBO voor deze treurige stand.",
    "Laag in het klassement. Ik overweeg serieus je rackets in beslag te nemen en ze te schenken aan de minigolf.",
  ],
  radioactief: [
    "De allerlaatste regionen van het klassement. Ik heb m'n pet diep over m'n ogen getrokken.",
    "De kelder is te chic verwoord: dit is de kruipruimte van het klassement.",
    "Onderaan. Het scorebord vroeg of het uitgezet mocht worden, uit medelijden.",
    "Hekkensluiter. Zelfs de FIFA kan deze cijfers niet corrupt genoeg herrekenen om je te redden.",
    "Zo diep in de kelder dat de terreinknecht een zaklamp voor je heeft klaargelegd.",
    "Onderin de lijst. Ik heb de bladzijde in m'n notitieboekje ritueel verbrand.",
    "De laatste plaats. Historisch slecht — en dat is óók een prestatie, op je eigen manier.",
    "De bodem van het klassement. Daaronder zit alleen nog de fundering van het complex.",
    "Onderaan, met afstand. Zelfs Trump zou dit geen overwinning durven noemen. Nou ja, hij wel.",
    "De kelder van de kelder. Ik heb de trauma-helikopter alvast stand-by gezet.",
    "Laatste. Zelfs een standbeeld had inmiddels meer Elo-punten gesprokkeld.",
    "Zo laag dat het klassement er een tweede pagina bij nodig had. Speciaal voor jou.",
    "De kruipruimte van de kelder. Zelfs de zwaartekracht schaamt zich voor dit dieptepunt.",
    "Allerlaatste. Ik heb Infantino gevraagd of we deze positie kunnen opschorten. Hij zei nee.",
    "Helemaal onderaan. Ik heb m'n coach-pet zojuist verbrand om dit drama te vergeten.",
    "De bodem van de lijst. Zelfs een standbeeld van Aurelio De Laurentiis had meer Elo-punten gesprokkeld.",
    "Een verontrustende wanprestatie in het klassement. We gaan de uitslagen per direct aanvechten.",
    "Onderaan, met gigantische achterstand. Ik heb de trauma-helikopter alvast stand-by gezet.",
    "De kruipruimte van de kelder. Zelfs de zwaartekracht schaamt zich.",
    "Allerlaatste. Ik heb Infantino gevraagd om de degradatie op te schorten.",
    "Bodem van de lijst. Ik overweeg m'n coachlicentie in te leveren.",
    "Historisch slecht. De terreinknecht heeft een zaklamp voor je achtergelaten.",
    "Helemaal onderaan. M'n notitieboekje ligt inmiddels in de vuilnisbak.",
    "Allerlaatste. Ik smeek Gianni Infantino om een wildcard om deze hopeloze vertoning uit het systeem te wissen.",
    "Bodem van de lijst. Zelfs de degradatiestreep weigert nog onder jouw troosteloze ranking te liggen.",
    "Kruipruimte van de kelder. Ik heb de marine al gebeld, maar ze weigeren zo diep te duiken voor jouw Elo.",
    "Absoluut dieptepunt. M'n tactische notitieboekje weigert spontaan dienst om deze rating te registreren.",
    "Helemaal onderaan. Zelfs m'n chique pak kreukt van pure plaatsvervangende schaamte als ik hiernaar kijk.",
  ],
} as const;

export const KELDER_NEUTRAAL = [
  "Onderin het klassement. De volgende match telt gewoon weer.",
  "Laag in de stand. Alle ruimte om te klimmen.",
  "De onderste regionen, voor nu. Het seizoen loopt nog.",
  "Een plek onderin de lijst. De weg omhoog ligt open.",
  "Onderin de tabel. Alle ruimte om weer omhoog te klimmen.",
  "Hekkensluiter voor nu. Volgende match nieuwe kansen.",
  "Laag geklasseerd. Tijd om de weg omhoog in te zetten.",
  "Kelderpositie — de ideale plek voor een spectaculaire klim.",
  "Onderin het klassement. Focus op de volgende wedstrijd om te stijgen.",
  "Laag in de stand. Alle kans om met een goede reeks te klimmen.",
  "Een plek onderin de lijst. De weg omhoog ligt helemaal open.",
  "Hekkensluiter voor nu. Blijf trainen en de punten volgen.",
  "Onderin de tabel. Nieuwe match, nieuwe kansen.",
] as const;

/** Zelfde contract als kiesFeit in coachFeed.ts: deterministisch één feit-lijn,
 *  of null zodat de aanroeper op de kále pool terugvalt. */
function kiesFeit(kandidaten: string[], seed: number): string | null {
  if (kandidaten.length === 0) return null;
  return kiesUniek(kandidaten, seed);
}

/** Groep-vs-globaal-contrast: hoog in de groep maar laag globaal (of andersom).
 *  De sappigste regel die er is, dus hij gaat vóór de tier-regels. */
function contrastFeiten(i: KlassementCommentaarInvoer): string[] {
  const { feiten, globaal } = i;
  if (feiten.scope !== "groep" || !globaal) return [];
  const groep = i.groepsNaam ?? "je groep";
  const l: string[] = [];
  if ((feiten.tier === "troon" || feiten.tier === "jager") && globaal.rank > 10) {
    l.push(
      `Hier op #${feiten.rank}, maar globaal #${globaal.rank} van ${globaal.totaal}. Perspectief is een gemene sport.`,
      `In ${groep} sta je te glanzen op #${feiten.rank}; de grote lijst zegt #${globaal.rank}. Ik rapporteer alleen wat m'n notitieboekje ziet.`,
      `#${feiten.rank} in ${groep}, #${globaal.rank} van ${globaal.totaal} globaal. Twee klassementen, twee waarheden — en maar één notitieboekje.`,
      `Lokale held, globale voetnoot: #${feiten.rank} hier, #${globaal.rank} daar. Zo houdt padel je nederig.`,
      `In ${groep} kijken ze tegen je op. De rest van de app kijkt vooral óver je heen, vanaf #${globaal.rank}.`,
      `De baas van ${groep}, en tegelijk #${globaal.rank} van ${globaal.totaal} in het geheel. Ik zou de persconferentie kort houden.`,
    );
  }
  if (feiten.tier === "kelder" && globaal.rank <= 10) {
    l.push(
      `Onderaan in ${groep}, maar globaal #${globaal.rank} van ${globaal.totaal}. Je zit gewoon in een haaienbak.`,
      `Hier de kelder, globaal de subtop (#${globaal.rank}). Conclusie: het ligt niet aan jou, het ligt aan je vrienden.`,
      `Laatste van ${groep} én #${globaal.rank} van de hele app. Zoek makkelijkere vrienden, zou ik zeggen.`,
    );
  }
  return l;
}

/** Sprong-regels ("3 plekken gezakt"), pas interessant vanaf twee plekken. */
function sprongFeiten(f: KlassementFeiten): string[] {
  if (f.shift === "nieuw") {
    return [
      `Nieuw binnengekomen op #${f.rank}. De lijst is gewaarschuwd.`,
      `Net in het klassement gedropt, meteen op #${f.rank}. Nu waarmaken.`,
    ];
  }
  if (typeof f.shift !== "number" || Math.abs(f.shift) < 2) return [];
  const n = Math.abs(f.shift);
  if (f.shift > 0) {
    return [
      `${n} plekken gestegen, naar #${f.rank}. De lift werkt dus wél.`,
      `${n} plekken omhoog, nu #${f.rank}. Zo klim je een klassement in, mensen.`,
    ];
  }
  return [
    `${n} plekken gezakt, naar #${f.rank}. De zwaartekracht heeft je gevonden.`,
    `${n} plekken omlaag, naar #${f.rank}. M'n notitieboekje kraakte toen ik het opschreef.`,
  ];
}

function troonFeiten(f: KlassementFeiten): string[] {
  if (f.deltaNaarOnder == null) return [];
  if (f.deltaNaarOnder <= JAGER_GAT) {
    return [
      `De troon is van jou, maar de marge is ${f.deltaNaarOnder} Elo. Ik zou de deur op slot doen.`,
      `Nummer één, met maar ${f.deltaNaarOnder} Elo voorsprong. De nummer twee zit op je hielen.`,
    ];
  }
  return [
    `${f.deltaNaarOnder} Elo voorsprong op de rest. De haaien ruiken bloed, maar jij zwemt voorlopig sneller.`,
    `Nummer één, met ${f.deltaNaarOnder} Elo buffer. Genoeg om rustig te slapen, te weinig om te verslappen.`,
  ];
}

function jagerFeiten(f: KlassementFeiten): string[] {
  if (f.deltaNaarBoven == null || f.buurmanBoven == null || f.deltaNaarBoven > JAGER_GAT)
    return [];
  return [
    `Nog ${f.deltaNaarBoven} Elo tot ${f.buurmanBoven}. Ik ruik bloed.`,
    `${f.buurmanBoven} staat maar ${f.deltaNaarBoven} Elo boven je. Die hoort je al hijgen.`,
    `${f.deltaNaarBoven} Elo. Dat is één goede avond padel tussen jou en ${f.buurmanBoven}.`,
  ];
}

function middenFeiten(f: KlassementFeiten): string[] {
  if (f.deltaNaarTop3 == null) return [];
  return [
    `#${f.rank} van ${f.totaal}, en maar ${f.deltaNaarTop3} Elo van de top-3. Dat podium staat dichterbij dan je denkt.`,
    `${f.deltaNaarTop3} Elo van de top-3. In m'n notitieboekje heet dat: geen excuus meer.`,
    `Op ${f.deltaNaarTop3} Elo van de top-3, als #${f.rank} van ${f.totaal}. Tijd voor een gedurfde wissel: meer winnen.`,
  ];
}

function kelderFeiten(f: KlassementFeiten): string[] {
  if (f.deltaNaarBoven == null || f.buurmanBoven == null) return [];
  return [
    `${f.buurmanBoven} staat maar ${f.deltaNaarBoven} Elo boven je. Zelfs de kelder heeft een uitgang.`,
    `Nog ${f.deltaNaarBoven} Elo tot ${f.buurmanBoven}. Pak die eerst, dan praten we verder.`,
  ];
}

/**
 * Coach Rudy's regel over jouw positie in het klassement. Deterministisch op de
 * seed; het contrast groep-vs-globaal wint van alles, daarna een feit-regel van
 * de tier en pas dan de kále pool. Het schild van de kijker maakt middenmoot en
 * kelder neutraal en slaat het contrast over; troon, jager en nieuw zijn lof of
 * neutraal en spreken gewoon door.
 */
export function coachKlassement(i: KlassementCommentaarInvoer): string {
  const seed = roastSeed("klassement", i.seed);
  const f = i.feiten;
  const schild = i.ctx.schild;
  if (!schild) {
    const contrast = kiesFeit(contrastFeiten(i), seed);
    if (contrast) return contrast;
  }
  switch (f.tier) {
    case "troon":
      return kiesFeit([...troonFeiten(f), ...(schild ? [] : sprongFeiten(f))], seed) ??
        kiesUniek(TROON, seed);
    case "jager":
      return kiesFeit([...jagerFeiten(f), ...(schild ? [] : sprongFeiten(f))], seed) ??
        kiesUniek(JAGER, seed);
    case "nieuw":
      return kiesUniek(NIEUW, seed);
    case "kelder":
      if (schild) return kiesUniek(KELDER_NEUTRAAL, seed);
      return kiesFeit([...kelderFeiten(f), ...sprongFeiten(f)], seed) ??
        kiesUniek(KELDER[i.ctx.intensiteit], seed);
    default:
      if (schild) return kiesUniek(MIDDENMOOT_NEUTRAAL, seed);
      return kiesFeit([...middenFeiten(f), ...sprongFeiten(f)], seed) ??
        kiesUniek(MIDDENMOOT, seed);
  }
}

/** De illustratie-stemming bij coachKlassement: bovenin trots, in de kelder de
 *  burn op groepsniveau (tenzij het schild hem neutraal maakt), anders het
 *  neutrale portret. */
export function coachKlassementMood(i: KlassementCommentaarInvoer): CoachMood {
  const tier = i.feiten.tier;
  if (tier === "troon" || tier === "jager") return "trots";
  if (tier === "kelder" && !i.ctx.schild) return i.ctx.intensiteit;
  return "portret";
}
