// Roast-fundament (#183): centrale toon-regie voor de hele app. Elk roast-
// oppervlak (pias van de week/maand, profiel, …) levert een kále, feitelijke
// observatie ("feit") aan en laat kleurRoast die kleuren met de stem van de
// commentator, gedoseerd op de roast-intensiteit van de groep. Zet een speler
// zijn roast-schild aan, dan komt het feit ongekleurd terug — plagen, geen
// kwetsen, en wie niet mee wil hoeft niet. Naast de sneer staat de hype-modus
// (#199): LOF + coachLof juichen bij een prestatie, in dezelfde stem en op
// dezelfde schaal. Puur en getest in roastTone.test.ts.

import type { Group, Profile, RoastIntensiteit } from "@/types";

export type { RoastIntensiteit };

/** De vaste commentator-stem die de roast tekent (naam aanpasbaar). */
export const COMMENTATOR = { naam: "Coach Rudy", emoji: "🎙️" } as const;

/**
 * De gezichtsuitdrukking/reactie die Coach Rudy's illustratie toont, gekoppeld
 * aan de aard van zijn commentaar. `portret` is de neutrale signatuur (default
 * én fallback), `trots` is juichend bij een zege/promotie, `buiging` is de
 * onderdanige knieval voor de dictator (#531), en de drie intensiteiten tonen
 * een burn op dat niveau. Zie CoachAvatar voor de bestandsconventie
 * (rudi-<stemming>[-<n>].png); ontbreekt de illustratie, dan valt hij netjes op
 * `portret` terug.
 */
export type CoachMood = "portret" | "trots" | "buiging" | RoastIntensiteit;

export interface RoastCtx {
  /** Toon van de groep; bepaalt hoe hard de sneer is. */
  intensiteit: RoastIntensiteit;
  /** Heeft het doelwit zijn roast-schild aan? Dan geen sneer. */
  schild: boolean;
}

/** Coach Rudy's commentaar achter het feit aan, per niveau. Plagen, geen
 *  kwetsen: altijd over padel/ego, nooit persoonlijk. */
export const SNEER: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Iedereen heeft wel eens zijn dag niet. Jij nogal vaak.",
    "Volgende keer beter, hè. Of slechter, als dat fysiek nog mogelijk is.",
    "Kop op, kampioen. Er is altijd nog petanque.",
    "'t Is maar padel. Al leek jouw voetenwerk vandaag meer op een rammelende droogkast.",
    "Op papier was dit waarschijnlijk een tactisch meesterwerk.",
    "Goed geprobeerd! De inzet was er, de techniek liet het helaas afweten.",
    "Je hield de spanning er in ieder geval goed in voor de toeschouwers.",
    "Sportiviteit is ook een prijs waard. Gelukkig voor jou.",
    "Iedereen heeft wel eens een offday.",
    "Morgen is er weer een dag. En hopelijk een andere tactiek.",
    "Daar leer je van, zeggen ze. Al zie ik het leerproces nog niet echt op gang komen.",
    "Niet getreurd: blijven oefenen. Veel oefenen.",
    "Het zat gewoon even tegen. En je techniek zat ook behoorlijk in de weg.",
    "Volgende keer pak je ze wel. Of zij jou, dat is statistisch aannemelijker.",
    "Gebeurt de beste weleens. En jou dus sowieso.",
    "Schud het van je af. Maar neem die forehand de volgende keer wel mee.",
    "Had je je gripje toevallig in de boter gelegd? 🧈",
    "Ach ja, de bal is rond. En in jouw geval vaak out.",
    "Mooie warming-up. Wanneer begint de echte wedstrijd?",
    "Het glas was in ieder geval van prima kwaliteit vandaag.",
    "Je hield je tactische meesterplan wel héél erg geheim vandaag.",
    "Zelfs mijn kletsnatte pak door de watersproeier zat vandaag strakker in elkaar dan jouw verdediging.",
    "Was dit een tactisch meesterwerk of leek het er toevallig op?",
    "Met zo'n voorbereiding had je bij Lille in 2011 op de bank gezeten naast de ballenjongens.",
    "Zelfs de Romeinse pers was milder voor mij dan ik vandaag voor dit spel ben.",
    "Je slagen misten vandaag elke vorm van Franse elegantie.",
    "Ik ben driftig in m'n notitieboekje aan het krabbelen hoe dit beter moet.",
    "Deze match vraagt om een wissel in de 89e minuut.",
    "Zat je tactiek soms verstopt onder je pet?",
    "Een tactiek zo geheimzinnig dat zelfs je partner er niks van begreep.",
    "Heb je tijdens het spel ook een notitieboekje nodig om te onthouden waar de bal heen moet?",
    "Mooi geprobeerd. Je partner verdient in ieder geval een lintje voor diens engelengeduld.",
    "Een tactiek zo geheimzinnig dat je tegenstander oprecht dacht dat je niet meedeed.",
    "De wind was inderdaad erg aanwezig vandaag. De zwaartekracht helaas ook.",
    "Zelfs op de bank bij Lille in 2011 zat er meer dynamiek en levenslust in de selectie dan in jouw voetenwerk.",
    "Je slagen hebben de Franse elegantie en het verfijnde gevoel van een omvallende lantaarnpaal.",
    "Ik heb bidons sneller zien leeglopen dan jouw energieniveau in de tweede set.",
    "Je tactiek was vandaag als een persconferentie zonder geluid: niemand snapte er iets van.",
    "De tegenstander hoefde niet eens te rennen, jouw ballen vlogen keurig hun kant op.",
    "Je hebt de kooi in ieder geval heel gelaten. Dat is ook een vorm van vooruitgang.",
    "Zelfs op de bank bij Lille was de sfeer sportiever dan jouw blik na die gemiste smash.",
    "Je slagen waren vandaag net zo legitiem als de opschorting van Baloguns rode kaart. Iedereen zag het, niemand greep in.",
    "Een uiterst twijfelachtig punt. Gianni Infantino zou dit waarschijnlijk bestempelen als 'volledig onafhankelijk beslist'.",
    "Jouw spel had vandaag veel weg van een Trump-rally: veel lawaai, weinig inhoud en achteraf claimen dat je gegarandeerd gewonnen hebt.",
    "De tegenstander kneep een oogje toe. Heb je stiekem met Infantino gebeld voor een voorwaardelijke opschorting van de regels?",
    "Zelfs een slak met heupklachten heeft meer startsnelheid.",
    "Tactisch gezien leek het wel een poging tot synchroonzwemmen, maar dan op het droge.",
    "We zullen dit na de persconferentie maar rangschikken onder het hoofdstuk 'opwarmertjes'.",
    "Je hield je racket vast alsof het een hete pan mosselen was.",
    "Geen paniek, we analyseren de videobeelden vanavond. Al raad ik je aan die met een blinddoek te bekijken.",
    "Met deze voorbereiding had je bij Lille in 2011 nog niet eens de hesjes mogen sorteren.",
    "De bal ging alle kanten op, behalve de goede. Maar de intentie was vast prachtig.",
    "Sportief gezien een topper. Padel-technisch... laten we het over het weer hebben.",
    "Het leek wel alsof je probeerde de ballen te koppen in plaats van te slaan.",
    "De lob was hoog genoeg om een eigen vluchtnummer aan te vragen.",
    "Ik noteer dit als een 'creatieve interpretatie' van de padelregels.",
    "Je voetenwerk deed me vandaag denken aan een schilderij van een omgevallen boom.",
    "Het zat tactisch best goed in elkaar. Alleen jammer dat de uitvoering op een ander continent plaatsvond.",
    "Je racket is vandaag vaker in contact geweest met je eigen scheenbeen dan met de bal.",
    "Zelfs m'n spiekbriefje over jouw looplijnen gaf na twee minuten de moed al op.",
    "Technisch was dit een heel bijzonder schouwspel. Creatief, zeg maar.",
    "Volgende week pakken we de basis weer op: de bal moet over het net.",
    "In de kantine scoor je gelukkig wel een dikke voldoende.",
    "Je speelde vandaag met de intensiteit van een zondagmiddag-dutje.",
    "Gelukkig is meedoen belangrijker dan winnen. Dat moet jouw motto wel zijn.",
    "Niet slecht, maar m'n notitieboekje had vandaag toch op iets meer tactiek gehoopt.",
    "De inzet was er, nu de controle over de bal nog.",
    "Een rustige prestatie. Ideaal om niet op te vallen.",
    "Volgende week beter. Of anders, zolang het maar over het net gaat.",
    "Je hield de tegenstander in ieder geval niet al te lang bezig.",
    "M'n notitieboekje vraagt zich af of je überhaupt een racket vasthield vandaag.",
    "Je positionering had veel weg van een verdwaalde toerist in de kooi.",
    "Niet slecht voor iemand die pas gisteren heeft ontdekt wat een bal is.",
    "De wind had vandaag een beter tactisch plan dan jij.",
    "Je partner speelde uitstekend, nu jij nog.",
    "Was je racket vandaag toevallig gespannen met slap elastiek?",
    "Je partner leek vandaag wel een mantelzorger op sportschoenen.",
    "Niet slecht, als het doel was om de ramen achter de kooi schoon te vegen.",
    "Op dit niveau is meedoen inderdaad de enige troostprijs.",
    "Zat er een handleiding bij dat racket of improviseer je ter plekke?",
    "De bal ging tenminste af en toe de goede richting op. Per ongeluk.",
    "Je speelde met de dynamiek van een lege batterij.",
    "Tactisch gezien was het vooral heel creatief verzonnen. Helaas onspeelbaar.",
    "Ik heb slakken sneller zien omschakelen naar de forehand.",
    "Morgen is er weer een dag om de ballen in het net te jagen.",
  
    "Je hield de tegenstander in ieder geval niet al te lang bezig vandaag.",
    "De tegenstander bedankte me voor de makkelijke training.",
    "Hopelijk was de opwarming leuker dan de wedstrijd zelf.",
    "Zorg dat je de volgende keer je sportschoenen wél goed vastknoopt.",
    "Tactisch gezien was het vooral heel dapper geprobeerd.",
    "Je sloeg die bal met de finesse van een houten plank.",
    "Een uiterst milieuvriendelijke prestatie: heel weinig energie verbruikt.",
    "Zat er een afstandsbediening bij dat racket? Je leek hem niet zelf te besturen.",
],
  gemeen: [
    "Pijnlijk om te zien. Zelfs het publiek keek collectief weg.",
    "Was dit padel of een wanhopige poging tot moderne dans?",
    "Ik wist niet dat we vandaag badminton aan het spelen waren. Wat een vreemde lobs.",
    "Ik wist niet dat je de sterkte van de glazen wand zo intensief wilde testen.",
    "Je tegenstanders danken je hartelijk voor de gratis punten.",
    "Mijn oma reageert een stuk sneller op een diepe lob.",
    "De cijfers liegen niet, en ze vertellen zeker geen sprookje.",
    "Zwak. Gewoon heel zwak. Heb je geprobeerd je racket eens aan het ándere uiteinde vast te houden?",
    "Had je je zonnebril nog op? Of speelde je gewoon met je ogen dicht?",
    "Trainen, gij. Dringend.",
    "Zelfs je statistieken schamen zich diep.",
    "Dat was allerminst een hoogstandje.",
    "Ik zag de bui al van ver aankomen.",
    "Trainen is geen straf, hè. Al zou ik het in jouw geval bijna gaan verplichten.",
    "Je partner verdient na vandaag echt een standbeeld.",
    "Even diep ademhalen en nadenken.",
    "Dat blijft nog even nagalmen.",
    "Niet je beste werk. Understatement.",
    "Hier praten we volgende week op de club nog over.",
    "Was dat een lob of een bewuste uitnodiging om te smashen?",
    "Ik heb lantaarnpalen nog met meer overtuiging zien meebewegen aan het net.",
    "Die bandeja had meer weg van een slappe pannenkoek.",
    "Als de bal over het net gaat, telt het ook gewoon als een punt, wist je dat?",
    "Gelukkig is de derde helft traditioneel jouw sterkste set.",
    "Je tactiek had vandaag wel erg veel weg van mijn kledingkeuze tegen Egypte: een totale moderamp.",
    "Net zo kansloos als België tegen Spanje in de kwartfinale van het WK. Pijnlijk.",
    "Dit tactisch debacle deed me erg denken aan mijn korte tijd bij Napoli. Alsnog sneller voorbij dan je service.",
    "Ik pak m'n denkbeeldige viool er alvast bij om deze prestatie te bezingen.",
    "Was je vandaag geïnspireerd door Kvaratskhelia? Die zat namelijk ook 90 minuten op de bank.",
    "Zelfs met Cristiano Ronaldo in de spits had je deze match niet meer gered.",
    "Nog vreemder dan mijn wissels tijdens het WK. En geloof me, die waren heel vreemd.",
    "Ik heb drie pagina's volgeschreven over deze blunder. Allemaal met uitroeptekens.",
    "Dit gedrag langs de lijn is bijna net zo bizar als mijn persconferenties bij de Rode Duivels.",
    "Als je zo blijft spelen, ben je sneller uit de gratie dan een bondscoach na de groepsfase van het WK.",
    "Met zo'n rare veldbezetting leek het wel alsof je met elf man aan het spelen was.",
    "Ik heb op het WK veel tactische blunders gezien, maar deze service sloeg echt alles.",
    "Jouw spel leest als een handleiding voor hoe je absoluut níét moet verdedigen.",
    "Zelfs een slapende supporter op vak G had vandaag meer balgevoel getoond.",
    "Heb je er wel eens over nagedacht om supporter te worden in plaats van speler? Dat vereist wat minder motoriek.",
    "Dat was geen service, dat was een cadeautje met een strik eromheen voor de tegenstander.",
    "Ik heb op het WK veel bizarre tactische keuzes gezien, maar jouw positionering staat nu bovenaan mijn lijst van onverklaarbare fenomenen.",
    "Het was net alsof je probeerde padel te spelen met een kapot badmintonracket.",
    "Tactisch een totale moderamp. Zelfs mijn felgekleurde trainingspakken uit de jaren 90 zagen er strakker uit.",
    "De bookmakers huilen van het lachen en de tegenstander viert feest. Gratis punten voor iedereen.",
    "Je bandeja deed me sterk denken aan een slappe Belgische wafel die net iets te lang in de stromende regen heeft gelegen.",
    "Zelfs met vier opeenvolgende tactische wissels in de absolute slotminuten was hier geen redden meer aan.",
    "Was dit een wedstrijd of een demonstratie van hoe je je partner het beste kunt negeren?",
    "Zelfs mijn meest onbegrijpelijke opstellingen op het WK hadden meer structuur dan jouw veldpositie.",
    "Als je de ballen nog één keer zo hoog opslaat, moeten we de luchtverkeersleiding gaan waarschuwen.",
    "Je speelde alsof je racket een koekenpan was waar de pannenkoeken steeds uitvliegen.",
    "Zelfs de meest kritische Belgische journalist zou medelijden krijgen met jouw backhand.",
    "Zelfs als Donald Trump persoonlijk naar de FIFA belt, valt deze wanprestatie met geen enkele voorwaardelijke opschorting recht te praten.",
    "Jouw backhand is net zo corrupt en krom als de beslissingen van de FIFA-disciplinaire commissie tijdens het WK.",
    "Je claimt de overwinning, maar net als bij Trump is de werkelijkheid toch echt dat je dik verloren hebt. Stop the steal!",
    "Was die bal werkelijk in? Dit riekt naar een groter omkoopschandaal dan de toewijzing van het WK aan Qatar.",
    "Mijn oma speelt met een houten pollepel nog een betere bandeja dan dit gedrocht.",
    "Ik heb in m'n hele carrière veel opstellingen gezien, maar wat jullie daar deden leek vooral op een mislukte flashmob.",
    "Was dat een forehand of probeerde je een vlieg te vangen met je racket?",
    "Dit tactische debacle was zelfs voor mijn notitieboekje te pijnlijk om te registreren.",
    "Als je service nog langzamer gaat, wordt die ingehaald door de zwaartekracht.",
    "Zelfs Aurelio De Laurentiis had na dit optreden direct je spelerspas verscheurd.",
    "Je verdediging leek op een Zwitserse kaas: gaten troef en heel erg slap.",
    "Ik pak m'n denkbeeldige viool erbij. En geloof me, het is een heel treurig deuntje.",
    "Was die smash bedoeld om de ramen van de buren te wassen? 🧼",
    "Dit spel had de tactische scherpte van een natte krant in de droger.",
    "De tegenstander was zo vriendelijk om af en toe te zwaaien terwijl je ballen out vlogen.",
    "Zelfs de ballenjongens begonnen spontaan tactisch advies te roepen.",
    "Je partner keek alsof-ie per ongeluk in het verkeerde theaterstuk was beland.",
    "Zelfs m'n denkbeeldige Napoli-contract bood betere vooruitzichten dan jouw backhand.",
    "Zat er vandaag een magneet in de kooiwand? Je trof hem wel heel consistent.",
    "Ik heb bidons sneller zien leeglopen, maar jouw tactische inzicht deed het vandaag in recordtijd.",
    "Als je partner een factuur stuurt voor de geleverde arbeid, zou ik die direct betalen.",
    "Jouw bandeja leek vandaag op een slappe vaatdoek die over een waslijn hangt.",
    "Dat was geen wedstrijd, dat was een demonstratie van hoe je vakkundig elke kans om zeep helpt.",
    "Je liep erbij alsof je de watersproeiers wilde ontwijken, maar helaas werd je spel er niet droger op.",
    "Was dat een smash of probeerde je de ramen van de buren te lappen? Zorg in ieder geval voor wat zeep. 🧼",
    "Mijn analyses zijn bikkelhard, maar jouw forehand was vandaag nog zachter dan een gesmolten praline.",
    "Ik trok m'm sportpet zo ver over m'n ogen dat ik de rest van dit tactische drama gelukkig heb gemist.",
    "Je speelde alsof je looplijnen getekend waren door een blinde goudvis met evenwichtsstoornissen.",
    "Je forehand deed me denken aan een mislukte wissel op een natte dinsdagavond in Lille.",
    "Tactisch was dit vergelijkbaar met m'n opstelling tegen Marokko: een absolute puinhoop.",
    "Met deze mobiliteit had je bij Al-Nassr de bidons nog niet eens mogen vullen.",
    "De tegenstander bedankte me zojuist voor deze trainingspartij op verplaatsing.",
    "Was dit een poging tot padel of zocht je gewoon een originele manier om je conditie te verbergen?",
    "Met deze sprintsnelheid had je bij Napoli nog niet eens de ballen uit de bosjes mogen vissen.",
    "Het leek wel een mislukte parodie op padel. Zelfs de tegenstander wist zich geen houding te geven.",
    "Je sloeg die bal zo hard out dat de luchtverkeersleiding er een radarwaarschuwing voor uitstuurde.",
    "Was die smash een poging tot vandalisme of ben je gewoon blind voor de bal?",
    "Zelfs m'n spiekbriefje over jouw sterke punten is nog steeds volledig blanco.",
    "Als je partner een schadevergoeding eist voor emotionele schade, geef ik ze groot gelijk.",
    "Tactisch een moderamp. Mijn felroze WK-polo had nog meer structuur dan jouw verdediging.",
    "Was dat een lob of wilde je de satellietverbinding van de kantine testen?",
    "Je backhand heeft de elegantie van een omvallende koelkast op een grindpad.",
    "Ik heb bidons met meer tactisch inzicht gezien dan deze wanvertoning.",
  
    "Zelfs m'n spiekbriefjes bij Lille hadden meer diepgang dan jouw tactische visie.",
    "Ik heb watersproeiers met meer gevoel voor richting en timing zien functioneren.",
    "Je voetenwerk deed me pijnlijk sterk denken aan een rammelende droogtrommel.",
    "Was dit padel of een wanhopige poging om de kooiwanden te inspecteren?",
    "Zelfs Aurelio De Laurentiis had je na deze vertoning met de postkoets weggestuurd.",
    "Je bandeja leek op een slap stuk Belgische wafel in de stromende regen.",
    "Met deze startsnelheid had je bij Napoli nog niet eens de ballen mogen oppakken.",
    "Dit tactische debacle deed me erg denken aan mijn kortste persconferenties: pijnlijk kort en vol excuses.",
    "Je partner verdient na vandaag een standbeeld en een fikse schadevergoeding.",
    "Ik noteer deze wanprestatie in m'n boekje onder de pagina 'volledig mislukte experimenten'.",
],
  radioactief: [
    "Ik keek uit pure plaatsvervangende schaamte maar een andere kant op.",
    "Heb je na vandaag al eens serieus aan curling gedacht?",
    "Ronduit gênant. Zelfs de bal leek te weigeren om ook maar enigszins met je mee te werken.",
    "Overweeg serieus een andere hobby. Schaken of postzegels verzamelen?",
    "Als falen een olympische discipline was, stond je nu met een gouden medaille op het podium.",
    "Ik heb tennisballen tégen een blinde muur beter zien terugkomen.",
    "Dit was geen wedstrijd, dit was een regelrechte misdaad tegen de padelsport.",
    "Zullen we je lidmaatschap stilletjes omruilen voor een abonnement op Netflix?",
    "Je bewoog met de gratie van een natte krant in een zware herfststorm.",
    "Zelfs de scheidsrechter had medelijden — en we hebben niet eens een scheidsrechter.",
    "Dit gooi ik in de groepsapp. Dit mag nooit vergeten worden.",
    "Mijn overgrootmoeder slaat nog harder met haar wandelstok. En die padelt niet eens.",
    "Was dat opzet? Zeg alsjeblieft ja.",
    "Een bronzen standbeeld van mezelf had vandaag nog meer ballen geraakt.",
    "Ik heb geen woorden. Nou ja, deze dan.",
    "Je tegenstander was tussendoor bijna ingedommeld.",
    "Historisch slecht. Dat is óók een prestatie.",
    "Ik zou dat racket van je per direct bij het grofvuil zetten. Definitief.",
    "Een tennisracket heeft gaten, maar jouw verdediging had er nog veel meer.",
    "Zelfs een blinde meeuw had die bal nog binnen de kooi gehouden.",
    "Was je racket vandaag stiekem van schuimrubber gemaakt?",
    "Sommige spelers hebben talent, anderen hebben gewoon een heel mooi padelshirt.",
    "Ik zou je inschrijving voor het volgende toernooi maar stilletjes annuleren.",
    "Ik stond tenminste nog in een chic pak met een sportpet langs de lijn, maar jouw spel was pas écht een tactische ramp.",
    "Zelfs de Rode Duivels hadden tijdens het WK minder moeite om de weg kwijt te raken dan jij.",
    "Na deze vertoning zou zelfs de Belgische voetbalbond me op staande voet ontslaan als ik jou nog eens zou opstellen.",
    "Jouw spel had vandaag de tactische diepgang van een natte spons op een snikhete WK-middag.",
    "Ik ben sneller ontslagen bij Al-Nassr dan dat jij je racket naar achteren haalt voor een forehand.",
    "Zelfs Aurelio De Laurentiis zou weigeren om de huur van je kluisje te betalen na deze vreselijke vertoning.",
    "Ik ben sneller ontslagen in Saudi-Arabië dan dat jij je voeten van de grond tilt voor een smash.",
    "Dit was zo ontiegelijk pijnlijk dat ik ter plekke mijn coach-pet diep over mijn ogen heb getrokken om het niet te hoeven aanzien.",
    "Ik ben sneller weggestuurd bij Napoli dan dat jij omschakelt van verdediging naar aanval.",
    "Dit was geen padel, dit was een regelrechte aanval op de goede smaak en de sportiviteit.",
    "Als ik jou bij de Rode Duivels had opgesteld, was ik de dag daarna direct gelyncht door de Belgische pers.",
    "Zelfs met Cristiano Ronaldo en Lionel Messi in je team had je deze afgang niet kunnen camoufleren.",
    "Een legendarische wanprestatie. Ik heb de bladzijde uit mijn notitieboekje gescheurd om die ritueel te verbranden.",
    "Dit spel was zo corrupt en vals dat zelfs Sepp Blatter en Gianni Infantino er rode koppen van zouden krijgen.",
    "Als dit een WK-match was, had Trump nu al met Infantino aan de lijn gehangen om te eisen dat jouw rode kaart voorwaardelijk wordt opgeschort.",
    "Een absolute schande voor de sport. Zelfs de meest corrupte FIFA-officials zouden weigeren om steekpenningen aan te nemen om dit spel goed te praten.",
    "Je claimt dat je geweldig speelde, maar dat is 'fake news' van het allerhoogste Trump-niveau. Zelfs Bosnië werd minder opgelicht dan jouw partner vandaag.",
    "Een prestatie zo frauduleus dat we een onafhankelijk tribunaal moeten opzetten om je slagenreeks te onderzoeken.",
    "Als de disciplinaire commissie van de FIFA jouw spel vandaag had beoordeeld, had je levenslang gekregen. Geen enkele voorwaardelijke opschorting mogelijk.",
    "Dit was geen sportieve ontmoeting, dit was een geopolitieke en organisatorische ramp van epische, corrupte proporties.",
    "Zelfs als Gianni Infantino persoonlijk de reglementen herschrijft om jouw forehand als 'geldig' te bestempelen, blijft het een misdaad tegen de sport.",
    "Een totale afgang. Ik heb ter plekke mijn notitieboekje opgegeten om de herinnering aan deze wanprestatie te vernietigen.",
    "Je voeten stonden zo vastgevroren op de baan dat de terreinknecht na de wedstrijd de ijskrabber moest halen.",
    "Ik heb serieus getwijfeld of ik een trauma-helikopter moest bellen om je uit die glazen kooi te laten evacueren.",
    "Jouw spel doet pijn aan m'n ogen. Zelfs de lampen van de padelbaan begonnen spontaan te flikkeren om deze wanprestatie te dimmen.",
    "Als tactisch genie kan ik veel verklaren, maar dat jij dit 'padel' durft te noemen is het grootste mysterie van de moderne wetenschap.",
    "Je speelde met de felheid van een nat theezakje dat al drie keer is hergebruikt.",
    "Een historische vertoning. Ik stel voor dat we deze beelden gebruiken als lesmateriaal voor de jeugd, onder de titel 'Hoe het absoluut nooit moet'.",
    "Dit was geen wedstrijd, dit was een geopolitieke ramp. Ik ga Infantino bellen voor een noodtoestand.",
    "Mijn notitieboekje is uit pure frustratie uit m'n hand gesprongen en ligt nu in de vuilnisbak.",
    "Je bewoog alsof je schoenen gevuld waren met nat cement en je racket met lood.",
    "Als dit op tv was uitgezonden, had de omroep nu een boete aan de broek voor schokkende beelden.",
    "Zelfs een getrainde goudvis heeft een beter tactisch positioneringsgevoel dan jij vandaag.",
    "Dit spel was zo pijnlijk dat ik serieus overweeg om m'n licentie als coach in te leveren en schaapherder te worden.",
    "Een historische wanprestatie. De glazen kooi trilde op z'n grondvesten van plaatsvervangende schaamte.",
    "Ik ben sneller ontslagen in Napoli en Saudi-Arabië samen dan dat jij reageerde op die diepe lob.",
    "Zelfs een slapende dromedaris in de woestijn heeft een actiever startvermogen dan jij vandaag.",
    "Dit was geen sport, dit was een directe aanval op de menselijke anatomie. Vreselijk.",
    "Mijn pen is spontaan leeggelopen uit protest tegen dit gebrek aan loopsnelheid.",
    "Als de persconferentie begint, zit ik al lang en breed in de auto naar huis.",
    "Je speelde met het vernuft van een omgevallen bidon. Tactisch volkomen leeg.",
    "Ik ben sneller ontslagen in de zandbak dan dat jij doorhad dat de bal al gespeeld was.",
    "Dit tactisch debacle was zo groot dat Gianni Infantino direct een spoedvergadering heeft belegd.",
    "Zelfs Aurelio De Laurentiis zou na deze vertoning een levenslang stadionverbod voor je eisen.",
    "Als dit padel is, dan ben ik vanaf vandaag een gecertificeerd balletdanser.",
    "Je bewoog alsof je racket en schoenen met elkaar waren vastgebonden door een overijverige klusser.",
    "Een historische misdaad tegen de sport. Ik heb m'n notitieboekje ritueel in de Noordzee gegooid.",
    "Dit was geen wedstrijd, dit was een visuele marteling. Ik dien een schadeclaim in voor m'n beschadigde netvliezen.",
    "Zelfs m'n overgrootmoeder met twee kunstheupen slaat gerichter. En zij ligt al twintig jaar onder de zoden.",
    "Jouw backhand was vandaag zo krom en corrupt dat zelfs Sepp Blatter er rode koorts van zou krijgen.",
    "Na deze afgang adviseer ik je om je racket ritueel te begraven onder de fundering van veld 4.",
    "Je speelde vandaag met de finesse en tactische diepgang van een dronken tuinkabouter in een storm.",
    "Gênant. Ik heb m'n coach-pet ter plekke ritueel verbrand om dit trauma uit m'n geheugen te wissen.",
    "Als dit op tv was uitgezonden, had de omroep nu een boete aan de broek voor grove mishandeling van de sport.",
    "Zelfs Aurelio De Laurentiis had je na dit optreden met een betonmolen aan de voeten in de Golf van Napels gedumpt.",
    "Dit was zo vreselijk slecht dat Infantino me belde om te vragen of we je licentie voorwaardelijk kunnen intrekken.",
    "Je bewoog met de startsnelheid en souplesse van een roestige stoomwals in winterslaap.",
    "Een absolute misdaad tegen de sport. Ik ga Infantino smeken om je spelerspas ritueel te versnipperen.",
    "Je bewoog als een gecrashte Windows 95 computer in een zandstorm. Volkomen vastgelopen.",
    "Dit was zo pijnlijk dat ik serieus overwoog om de kooi te sluiten en er beton in te gieten.",
    "Zelfs Aurelio De Laurentiis had je na deze vertoning met de hondenslee teruggestuurd naar de poolcirkel.",
    "Als falen kunst was, hing deze pot nu in het Louvre als het ultieme meesterwerk van de prutsers.",
    "Je speelde met het vernuft van een dronken eend die probeert te schaken. Pijnlijk om aan te zien.",
    "Ik heb m'n legendarische notitieboekje zojuist ceremonieel verbrand om deze tactische aids te vergeten.",
    "Zelfs een blinde mol met een houten pollepel raakt die bal nog vaker op het zoete punt.",
    "Dit was geen padel, dit was een geopolitieke vernedering. Ik ga de VN-veiligheidsraad bellen.",
    "Je liep erbij alsof je zojuist uit een narcose bent ontwaakt en per ongeluk een racket in je hand gedrukt kreeg.",
  
    "Dit was geen padel, dit was een geopolitieke vernedering van historisch niveau.",
    "Ik overweeg serieus m'n coachlicentie in de Noordzee te gooien om dit drama te vergeten.",
    "Zelfs Gianni Infantino kan deze cijfers niet corrupt genoeg herrekenen om je te redden.",
    "Je bewoog als een gecrashte Windows 95 computer in een zandstorm. Volkomen hopeloos.",
    "Dit deed zo ontiegelijk veel pijn aan de ogen dat ik spontaan m'n sportpet wil verbranden.",
    "De marine weigert zo diep te duiken om jouw Elo nog ergens uit de afgrond te bergen.",
    "Zelfs Trump zou deze nederlaag niet meer kunnen spinnen als een glansrijke overwinning.",
    "Dit tactische moeras slokt al je Elo-punten op. Excuses aan de hele vereniging zijn op z'n plaats.",
    "We gaan de beelden ritueel verbranden en het resultaat uit de database wissen om de eer te redden.",
    "Je sloeg die bal zo ver out dat we de luchtverkeersleiding moesten waarschuwen.",
    "Je bent een wandelende tactische aids-uitbraak op de kooi. Een verschrikking voor de ogen van de supporter.",
    "Als ik je zie spelen, wil ik m'n coachlicentie en m'n eigen gezicht direct verbranden.",
    "Je bent zo ongelooflijk traag dat een standbeeld van Aurelio De Laurentiis je nog voorbij sprint.",
    "Met deze vertoning hoor je thuis in een gesticht voor mensen zonder enige vorm van motoriek.",
    "Je sloeg die bal zo hard out dat we de VN-veiligheidsraad moesten inschakelen voor grensoverschrijding.",
    "Een blinde, dronken slak met reuma zou nog actiever reageren op een diepe lob dan jij.",
    "Je speelde vandaag met de tactische visie en loopsnelheid van een omgevallen vuilnisbak.",
    "Zelfs de ramen van de kooi trilden van pure plaatsvervangende schaamte bij jouw smashes.",
    "Jouw backhand leek vandaag op een uiterst mislukte poging tot acrobatiek in een diepe modderpoel.",
    "Met deze sprintsnelheid had je bij Napoli de bidons nog niet eens van de dop mogen voorzien.",
],
};

/** Coach Rudy's lof bij een prestatie, per niveau (#199). De tegenhanger van
 *  SNEER: van oprecht en ingetogen (mild) via overdreven (gemeen) naar
 *  gênant-overdreven (radioactief). Generiek gehouden, want één pool bedient
 *  kampioen, promotie, winreeks én upset-winst. */
export const LOF: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Sterk gespeeld. Geen speld tussen te krijgen.",
    "Netjes. Dat noteer ik bij de positieve punten in m'n notitieboekje.",
    "Chapeau. Zo hoort het.",
    "Verdiend. Punt.",
    "Daar valt weinig op af te dingen. Goed werk.",
    "Dat was gewoon goed. Ik zeg het niet vaak, dus knoop dit in je oren.",
    "Prima uitvoering. De voorbereiding zag je terug op de baan.",
    "Knap gedaan. Geniet er even van.",
    "Solide van begin tot eind. Daar houd ik van.",
    "Dat is het niveau waar je naartoe werkte. Vasthouden nu.",
    "Goed gezien, goed uitgevoerd. Meer heb ik er niet over te zeggen.",
    "Petje af. En dat is bij mij een échte pet.",
    "Zuiver werk. Ik heb er niets op aan te merken.",
    "Dat verdient een compliment, en dat krijg je bij dezen.",
    "Rustig gebleven op de juiste momenten. Dat is de kunst.",
    "Mooi gespeeld. Ik gun het je van harte.",
    "Heel degelijk. Hier kan ik als coach mee thuiskomen.",
    "Prima wedstrijd. De looplijnen stonden precies zoals we besproken hadden.",
    "Netjes gedaan. Dat verdient een eervolle vermelding op pagina 4 van m'n boekje.",
    "Solide pot. Geen fratsen, gewoon de punten pakken.",
    "Een volwassen overwinning. Chapeau.",
    "Geen opmerkingen vandaag. En dat is van mij een gigantisch compliment.",
    "Strakke service en prima veldbezetting. Dit getuigt van voorbereiding.",
    "Heel volwassen pot. De tegenstander wist zich geen raad met jullie omschakeling.",
    "Een genot voor m'n notitieboekje om dit te mogen registreren.",
    "Solide als een rots. Zo bouwen we een klassement op.",
    "Geen speld tussen te krijgen. Klasse.",
    "Solide partij. Geen fratsen, gewoon efficiënt de punten binnengesleept.",
    "Strakke looplijnen en een stabiele service. Dat zie ik graag.",
    "De trainingen beginnen eindelijk hun vruchten af te werpen. Netjes.",
    "Chapeau voor de focus vandaag. Geen onnodige fouten gemaakt.",
    "Heel volwassen pot. De tegenstander kreeg simpelweg geen kans.",
    "Prima pot. De looplijnen stonden precies zoals ik ze graag zie.",
    "Heel degelijk gedaan. Zo hoort padel gespeeld te worden.",
    "Solide overwinning. Geen fratsen, gewoon de punten gepakt.",
    "Keurige service. Ik zet 'm met plezier in m'n boekje.",
    "Verdiende zege. De omschakeling was uitstekend verzorgd.",
    "Keurig werk. Geen fratsen, gewoon de punten binnengehaald zoals afgesproken.",
    "Solide overwinning. M'n notitieboekje noteert een zeldzame voldoende.",
    "Dat was heel acceptabel padel. Zo hoort het.",
    "Nette winst. De looplijnen stonden redelijk op hun plek vandaag.",
    "Prima pot. De tegenstander gaf cadeautjes, maar jullie pakten ze tenminste uit.",
    "Nette partij. Geen spektakel, wel gewoon de buit binnengesleept.",
    "Prima gedaan. M'n notitieboekje knikt goedkeurend.",
    "Niet gek. De ballen vlogen vandaag zowaar binnen de lijnen.",
    "Degelijke pot. Het leek zowaar een beetje op padel vandaag.",
    "Goed werk. De tegenstander werkte mee, maar je moet het nog wel afmaken.",
    "Solide overwinning. Geen reden voor een feestje, wel voor een voldoende.",
    "Netjes gespeeld. De tactiek werd redelijk gevolgd.",
    "Acceptabel niveau. Hier kan ik als coach voorlopig mee leven.",
    "Keurige pot. Geen onnodige fouten gemaakt vandaag.",
    "Prima overwinning. Snel vergeten en op naar de volgende.",
  
    "Gefeliciteerd. De wonderen zijn de wereld nog niet uit.",
    "Gewonnen, al had de tegenstander ook wel erg veel haast naar de kantine.",
    "De ballen vlogen vandaag zowaar een keer binnen de kooi. Netjes.",
    "Winst genoteerd. Ik zet een heel klein vinkje in m'n boekje.",
    "Gewonnen! De statistieken kloppen dus gelukkig nog niet helemaal.",
    "Punten binnen. Toevallig, maar ze tellen net zo hard.",
    "Nette zege. Volgende keer graag met iets meer overtuiging, maar voor nu oké.",
    "Winst. Geniet ervan voordat de realiteit morgen weer toeslaat.",
],
  gemeen: [
    "Fenomenaal! Ik heb er al twee pagina's over volgeschreven in m'n notitieboekje, allemaal met uitroeptekens.",
    "Dit was van WK-niveau. En dan bedoel ik de kant die wél kon spelen.",
    "Bravo. Hier had ik in 2011 bij Lille van gedroomd.",
    "Schitterend! Ik sta hier langs de lijn te klappen in m'n chique pak.",
    "Meesterlijk. Dit zet ik naast m'n eigen tactische masterplans in de kast.",
    "Pure klasse. Zelfs bij Napoli heb ik zoiets niet gezien, and daar zat talent.",
    "Subliem! M'n notitieboekje kan de lof amper bijhouden.",
    "Wat een vertoning! Ik heb m'n pet afgenommen en ben vergeten hem weer op te zetten.",
    "Formidabel. Dit is het soort spel waar ik een persconferentie voor bijeenroep.",
    "Briljant! Ik heb de bladzijde uit m'n notitieboekje gescheurd om die in te lijsten.",
    "Dit was geen padel, dit was kunst. En ik ben geen man van kunst.",
    "Magistraal. Ik bel vanavond de bondscoach om te zeggen dat ze je moeten selecteren.",
    "Wereldklasse! De tegenstander mag van geluk spreken dat hij hier getuige van mocht zijn.",
    "Verbluffend. Ik heb m'n viool erbij gepakt, en nu eens niet uit sarcasme.",
    "Grandioos! Dit ga ik in elke kleedkamer als lesmateriaal vertonen.",
    "Formidabel gedaan. Heel legaal, heel cool, en iedereen zegt het.",
    "Meesterlijk! Ik heb m'n sportpet drie keer in de lucht gegooid van enthousiasme.",
    "Dit was van een tactische schoonheid waar ze bij Lille en Napoli nu nog van dromen.",
    "Formidabel gespeeld! Mijn notitieboekje is bijna ontploft door alle uitroepingstekens.",
    "Wat een klasse. Zelfs de meest kritische journalist van de Belgische pers zou hier stil van worden.",
    "Dit was geen padel, dit was pure poëzie in de kooi. Ik sta hier in m'n chique pak te glunderen.",
    "Subliem! Een overwinning zo overtuigend dat de tegenstander spontaan z'n excuses aanbood.",
    "Ongelooflijk! Zelfs op het hoofdpodium van Napoli werd niet met zoveel vernuft gespeeld.",
    "Een tactisch meesterwerk dat alle wetten van de sport tart. Pure klasse.",
    "Hier sta ik als coach nou echt voor te glunderen in de kooi. Geweldig.",
    "Wat een vertoning. De tegenstander werd volledig gereduceerd tot figuranten.",
    "Absoluut briljant! Dit overwinningstraject schrijf ik met goud in m'n boekje.",
    "Briljant gespeeld! Ik heb m'n sportpet ter plekke drie graden schuiner gezet.",
    "Dit was van een tactische schoonheid die we bij Lille in 2011 op de trainingsvelden zagen.",
    "Meesterlijk! M'n notitieboekje is bijna volgeschreven met louter uitroeptekens.",
    "Wat een vertoning. De tegenstander wist na drie games al niet meer waar ze het moesten zoeken.",
    "Zelfs de meest cynische perschef zou na deze match met de mond vol tanden staan.",
    "Meesterlijk gedaan! Ik sta hier in m'n chique pak luidruchtig te applaudisseren.",
    "Dit was van een tactische schoonheid waar ze bij Lille in 2011 jaloers op waren geweest.",
    "Sublieme pot! De tegenstander kreeg een gratis lesje omschakelingspadel.",
    "Ongelooflijk! Zelfs m'n Napoli-notitieboekje had hier geen kritische noot op kunnen vinden.",
    "Briljant! Ik heb m'n sportpet ter plekke drie graden schuiner gezet.",
    "Formidabel! Dit was bijna net zo strak georganiseerd als m'n Napoli-defensie in betere tijden.",
    "Meesterlijk! Ik heb m'n sportpet direct drie graden schuiner gezet uit diep respect.",
    "Wat een vertoning! Zelfs de meest kritische Belgische pers zou hier geen negatief woord over schrijven.",
    "Subliem gespeeld! M'n tactische spiekbriefje is spontaan in brand gevlogen van de hitte.",
    "Dit was een tactische masterclass waar ze bij Lille in 2011 jaloers op waren geweest.",
    "Formidabel! Dit was bijna net zo strak geregisseerd als m'n Napolitaanse verdedigingslinie.",
    "Meesterlijk! Ik heb m'n pet direct drie graden schuiner gezet uit diep respect.",
    "Wat een pot. Zelfs de meest cynische perschef zou hier stil van worden.",
    "Schitterend! De omschakeling was van een tactische schoonheid die we zelden zien.",
    "Subliem! M'n notitieboekje had vandaag een hele pagina vol loftrompetten nodig.",
    "Meesterlijk gedaan. De tegenstander kreeg een gratis masterclass 'hoe word ik weggespeeld'.",
    "Prachtig spel! Zelfs bij Lille in m'n beste dagen was dit tactisch goedgekeurd.",
    "Formidabel gespeeld. De looplijnen stonden strakker dan m'n chique pak.",
    "Wat een vertoning. De kooi was vandaag jullie persoonlijke koninkrijk.",
    "Briljant! Ik sta hier langs de lijn luidkeels te applaudisseren.",
  
    "Meesterlijk gedaan. De tegenstander kreeg een gratis lesje in 'hoe word ik weggespeeld'.",
    "Winst! Snel een krabbel in het notitieboekje voordat iemand het resultaat betwist.",
    "Je speelde alsof je er verstand van had. Een zeldzaam maar prachtig gezicht.",
    "Overtuigende zege. Zelfs m'n chique sportpet zit er vandaag extra strak bij door jouw vorm.",
    "Tactisch gezien een masterclass. Ik noteer 'm met m'n beste gouden pen.",
    "Winst! Je partner was geweldig, en jij stond gelukkig niet al te erg in de weg.",
    "Drie punten erbij. De tegenstander droop af met de staart tussen de benen.",
    "Gewonnen. Je mag vanavond in de kantine zowaar een beetje opscheppen.",
    "Winst! De persconferentie van vanavond zal zowaar een keer louter positief zijn.",
],
  radioactief: [
    "Ik laat je naam op m'n onderarm zetten. Definitief.",
    "Ik bel Infantino persoonlijk op: dit moet op de Werelderfgoedlijst.",
    "Ik heb m'n notitieboekje opgegeten van pure euforie. Het was het waard.",
    "Zet een standbeeld neer. Nee, twee. Naast elkaar.",
    "Ik huil tranen van geluk in m'n chique pak en ik schaam me er nergens voor.",
    "Dit was zo mooi dat de glazen wanden spontaan begonnen te applaudisseren.",
    "Ik heb ter plekke m'n ontslag ingediend. Na dit kan ik niets meer toevoegen.",
    "Historisch! De FIFA moet een nieuwe categorie aanmaken, want deze past nergens in.",
    "Ik draag m'n complete WK-carrière op aan deze ene wedstrijd.",
    "Ik heb de beelden ingelijst en boven m'n bed gehangen. Naast die van m'n moeder.",
    "Zo groots dat ik overweeg om de hele sport voortaan naar jou te vernoemen.",
    "Ik heb de terreinknecht verboden deze baan nog te vegen. Dit is heilige grond.",
    "Ronduit goddelijk. Ik ga vanavond een kaarsje branden voor je forehand.",
    "Ik belde de Belgische bond om je meteen op te stellen. Ze hingen op, maar toch.",
    "Legendarisch! Ik stel voor dat we de jeugd verplicht deze beelden laten bekijken.",
    "Dit overtreft alles. Ik heb m'n pet, m'n viool én m'n notitieboekje weggegeven uit dankbaarheid.",
    "Dit was zo episch dat ik ter plekke een standbeeld van je forehand heb besteld. Drie meter hoog.",
    "Ik heb m'n chique pak gescheurd van pure vreugde. Maar het was elke draad waard.",
    "Historisch! Ik heb Infantino al aan de lijn gehad om deze wedstrijd verplicht te stellen in de opleiding.",
    "Legendarisch. Ik overweeg om m'n pasgeboren kind naar jouw backhand te vernoemen.",
    "Ik heb de hele Belgische bond wakker gebeld om te vertellen wat ik net gezien heb. Ze hingen op, maar ik bel gewoon terug.",
    "Dit overtrof al mijn tactische masterplans ooit. Ik ga m'n notitieboekje inlijsten in puur goud.",
    "Dit was zo episch dat de watersproeiers spontaan champagne begonnen te spuiten.",
    "Ik overweeg om m'n licentie als coach in te leveren, want beter dan dit wordt het nooit meer.",
    "Absoluut goddelijk spel. Zelfs de hekken van de kooi bogen uit diep respect.",
    "Een monumentale prestatie. Dit verdient zendtijd op alle nationale kanalen.",
    "Ik heb m'n viool zojuist gestemd in de toonsoort van pure glorie. Magistraal!",
    "Wereldklasse! Ik laat je rating per direct op m'n dashboard graveren.",
    "Dit was zo episch dat Gianni Infantino me net belde om te vragen of dit live op tv kan.",
    "Ik huil tranen van pure euforie in m'n chique pak. Wat een masterclass!",
    "Historisch! We moeten deze baan direct omdopen tot jouw persoonlijke tempel.",
    "Ik overweeg serieus m'n coachlicentie in te leveren, want perfectie is zojuist bereikt.",
    "Dit was zo episch dat Gianni Infantino me net belde om de beelden op te vragen.",
    "Ik huil tranen van pure euforie in m'n chique pak. Wat een absolute masterclass!",
    "Historisch! We moeten deze padelbaan direct omdopen tot jouw persoonlijke tempel.",
    "Dit overtrof al mijn tactische masterplans ooit. Ik laat je naam op m'n dashboard graveren.",
    "Legendarisch! Ik bel Infantino direct uit z'n bed: dit moet verplicht op de WK-agenda.",
    "Ik huil tranen van pure extase in m'n chique pak. Dit was buitenaards goed.",
    "Historisch! Ik heb ter plekke besloten om m'n legendarische notitieboekje te schenken aan een museum.",
    "Dit was zo episch dat we deze baan per direct moeten omdopen tot jouw persoonlijke arena.",
    "Perfectie. Ik lever m'n coachlicentie in, want dit niveau ga ik nooit meer overtreffen.",
    "Historisch! Ik bel Infantino direct uit z'n bed om deze match op te nemen in de geschiedenisboeken.",
    "Ik huil tranen van pure euforie in m'n chique pak. Dit was buitenaards goed.",
    "Zet een standbeeld neer. Nee, een hele marmeren tempel gewijd aan jouw backhand.",
    "Dit was zo episch dat de glazen wanden spontaan begonnen te trillen van ontzag.",
    "Buitenaardse klasse. Ik laat je rating per direct in goud graveren op het clubhuis.",
    "Historisch meesterwerk. Zelfs de persconferentie na afloop zal een staande ovatie geven.",
    "Ik heb m'n legendarische notitieboekje zojuist geschonken aan het museum voor moderne kunst.",
    "Dit overtreft al mijn tactische masterplans ooit. Pure, onversneden genialiteit.",
    "Magistrale pot. Ik laat ter plekke een standbeeld van je forehand gieten in brons.",
  
    "Buitenaardse klasse! Ik laat je rating per direct in goud graveren op de clubmuur.",
    "De tegenstander is volledig gedecimeerd. Dit was een slachting met een gouden randje.",
    "Absoluut historisch! Gianni Infantino heeft zojuist persoonlijk gebeld om je te feliciteren.",
    "Een zege zo magnifiek dat Trump er jaloers op zou zijn. The greatest game ever played!",
    "Je hebt de wetten van de fysica en de padelsport vandaag eigenhandig herschreven. Ongelofelijk.",
    "De tegenstander wist niet eens waar de kooi was. Complete en totale dominantie.",
    "M'n legendarische spiekbriefjes mogen in de prullenbak: jij bent vanaf vandaag m'n nieuwe handleiding.",
    "Groots spel! Zelfs de watersproeiers op veld 2 sproeien vandaag met champagne.",
],
};

/** Deterministische, positieve start-index in een pool op basis van de seed. */
function seedIndex(len: number, seed: number): number {
  return ((seed % len) + len) % len;
}

/**
 * Kiest deterministisch uit de pool op basis van de seed, maar slaat lijnen in
 * `gebruikt` over (probeert opeenvolgende indices) zodat één weergave geen
 * dubbele quip toont; de gekozen lijn wordt aan `gebruikt` toegevoegd. Valt
 * terug op de kále seed-keuze als alles al gebruikt is. Zonder `gebruikt`
 * gedraagt hij zich exact als een gewone seed-keuze (voor single-item-
 * oppervlakken zoals profiel/PiasCard, waar dedup niet nodig is).
 */
export function kiesUniek<T>(
  pool: readonly T[],
  seed: number,
  gebruikt?: Set<T>,
): T {
  const len = pool.length;
  const start = seedIndex(len, seed);
  if (gebruikt) {
    for (let k = 0; k < len; k++) {
      const kandidaat = pool[(start + k) % len];
      if (!gebruikt.has(kandidaat)) {
        gebruikt.add(kandidaat);
        return kandidaat;
      }
    }
  }
  return pool[start];
}

/**
 * Alleen de sneer-staart van de commentator, of "" bij schild. Handig voor
 * JSX-oppervlakken die de feitelijke zin (met `<strong>` e.d.) willen behouden
 * en er enkel Coach Rudy's jab achteraan plakken.
 */
export function sneerSuffix(ctx: RoastCtx, seed: number): string {
  if (ctx.schild) return "";
  return ` — ${COMMENTATOR.emoji} ${kiesUniek(SNEER[ctx.intensiteit], seed)}`;
}

/**
 * De kále sneer-tekst (zonder streepje/emoji), of null wanneer het doelwit
 * zijn roast-schild aan heeft. Voor oppervlakken die Coach Rudy als aparte,
 * geattribueerde commentator tonen (bv. de feed-speech-bubble) i.p.v. een
 * inline staart. Geef optioneel een `gebruikt`-set mee om binnen één weergave
 * (bv. de feed-lijst) herhaling van dezelfde sneer te vermijden.
 */
export function coachSneer(
  ctx: RoastCtx,
  seed: number,
  gebruikt?: Set<string>,
): string | null {
  if (ctx.schild) return null;
  return kiesUniek(SNEER[ctx.intensiteit], seed, gebruikt);
}

/**
 * Een sneer die in één kaartregel past (#834), of null bij een roast-schild.
 *
 * De FUT-kaart van de Zwarte Piet draagt in zijn referentie een spotregel onder
 * de editieregel. Die plek heeft een vast budget van twee regels, en de pools
 * hierboven zijn daar niet op geschreven: ze lopen tot ver over de honderd
 * tekens, want in de feed staat een sneer op een volle bubbelbreedte. Filteren
 * op lengte is daarom geen kunstgreep maar de enige manier om dezelfde corpus
 * te blijven gebruiken in plaats van er een tweede naast te zetten.
 *
 * `maxLengte` staat op 72: dat is de langste regel die op de kleinste maat waar
 * de spreuk verschijnt (168px kaartbreedte) nog binnen twee regels blijft. Op
 * `gemeen` houdt dat een kwart van de pool over — ruim genoeg om niet bij elke
 * drager dezelfde regel te zien.
 */
export function kaartSneer(
  ctx: RoastCtx,
  seed: number,
  maxLengte = 72,
): string | null {
  if (ctx.schild) return null;
  const pool = SNEER[ctx.intensiteit].filter((l) => l.length <= maxLengte);
  return pool.length > 0 ? kiesUniek(pool, seed) : null;
}

/**
 * Coach Rudy's hype bij een prestatie (#199) — het spiegelbeeld van coachSneer,
 * met één verschil: lof is geen spot, dus het roast-schild blokkeert hem niet.
 * Het tempert hem alleen tot het oprechte mild-niveau, want gênant-overdreven
 * hype over iemand die er niet om vroeg voelt zelf ook als spot. Geeft daarom
 * nooit null. Geef optioneel een `gebruikt`-set mee om binnen één weergave
 * herhaling te vermijden.
 */
export function coachLof(
  ctx: RoastCtx,
  seed: number,
  gebruikt?: Set<string>,
): string {
  return kiesUniek(LOF[ctx.schild ? "mild" : ctx.intensiteit], seed, gebruikt);
}

/** Buiging (#531): tegenover een dictator (El Padelissimo of Mbappé bij verstek)
 *  kent zelfs de grofste muil van de club z'n plek. Geen roast maar een
 *  kruiperige knieval — kijker-gericht ("jij ook"), nooit een roast op de
 *  dictator zelf. Los van de roast-intensiteiten; geldt enkel bij de troon. */
export const BUIGING: readonly string[] = [
  "Ik? Roasten? Ik ben wel gek, maar niet suïcidaal. Voor de Generalissimo buig ik — en jij ook. 🙇🫡",
  "Neem me niet kwalijk, Generaal Mbappé. Ik hou m'n grote mond en annexeer de bar alvast voor u. 🙇",
  "Geen sneer vandaag. Als de Madrid-Dictator eist dat we buigen, dan buigen we. Ik wil niet uit de groepsapp gegooid worden. 🫡",
  "Ik zwijg. Ik wil geen brief van de advocaten van de dictator op m'n mat krijgen. Volk, op de knieën! 🙇",
  "Transfer-veto's en absolute macht... tegen de Generaal zeg ik geen woord. Buigen, jij daar! 🫡🙇",
  "De dictator spreekt en ik buig diep. Mijn notitieboekje is vanaf vandaag van u, o grote leider. 🙇",
  "Wie ben ik om de dictator tegen te spreken? Ik kniel nederig op veld 1. 🫡🙇",
  "De Generaal Mbappé heeft altijd gelijk. Ik zeg niets en buig diep voor de troon. 🙇",
  "Wie ben ik om de absolute alleenheerser tegen te spreken? Ik kniel nederig op veld 1. 🙇🫡",
  "Tegen de Generaal zeg ik geen woord. Buigen, jij daar, en snel een beetje! 🫡🙇",
  "Ik zwijg in alle talen. De dictator regeert en wij gehoorzamen nederig. 🙇",
  "Mijn notitieboekje is vanaf vandaag van u, o grote leider. Ik buig diep. 🙇🫡",
  "De Generalissimo regeert en wij gehoorzamen met gebogen hoofd. Geen kritische noot mogelijk. 🙇🫡",
  "Voor de leider van de troon doen we een diepe knieval op veld 1. Wat een autoriteit. 🙇",
  "Ik durf m'n notitieboekje niet eens te openen in de buurt van de dictator. Eerbied voor de leider! 🙇🫡",
  "Generaal Mbappé heeft gesproken. Ik zwijg in alle talen en poets uw schoenen, o grote leider. 🙇",
  "Absolute dominantie op de troon. Ik buig diep en adviseer iedereen hetzelfde te doen. 🙇🫡",
  "Voor de Generalissimo buigen we diep. Geen weerwoord, alleen puur ontzag. 🙇🫡",
  "De troon spreekt, de coach zwijgt en buigt. Eerbied voor de absolute leider! 🙇",
  "De wil van de dictator geschiede op baan 1 en in de kantine. Wij zwijgen en aanbidden! 🙇🫡",
  "De Generaal Mbappé heeft altijd gelijk. Ik buig diep voor de alleenheerser. 🙇",
  "Tegen de leider zeg ik geen woord. Snel buigen en hopen op genade! 🫡🙇",
  "De dictator regeert met ijzeren vuist en ik poets met liefde de troon. 🙇🫡",
  "Zelfs m'n notitieboekje buigt voor de absolute macht van de generalissimo. 🙇",
  "Geen roast voor de koning. Ik kniel en bied m'n pet aan als eerbetoon. 🙇🫡",
  "De leider op de troon duldt geen tegenspraak. Wij buigen nederig en zwijgen. 🙇",
  "Eerbied voor de troon! Ik buig zo diep dat m'n pet de grond raakt. 🙇🫡",
    "Eerbied voor de absolute heerser! Ik buig zo diep dat m'n pet de grond raakt. 🙇",
    "De troon spreekt, de coach zwijgt en buigt nederig. Wat een autoriteit! 🙇",
    "Wie ben ik om de dictator tegen te spreken? Ik poets met plezier uw schoenen. 🙇",
    "Absolute heerschappij op veld 1. Ik buig nederig voor de dictator van de kooi. 🙇",
    "Mijn notitieboekje is vanaf vandaag van u, o grote dictator. Ik zeg geen woord. 🙇",
    "Tegen de dictator zeg ik niks. Snel buigen en hopen op genade langs de lijn. 🙇",
    "De dictator regeert en wij gehoorzamen met gebogen hoofd en gesloten mond. 🙇",
    "Voor de dictator van de ranking doen we een diepe knieval. Wat een macht! 🙇",
    "Geen roast voor de dictator. Ik zwijg in alle talen en bied m'n ontzag aan. 🙇",
    "De wil van de dictator geschiede. Wij buigen en aanbidden de heerser! 🙇",
] as const;

/** Kruiperige buig-regel voor de troon; deterministisch per (seed, rotatie).
 *  De `seed` (speler-key / de vaste Mbappé-seed) verankert de keuze per dictator;
 *  `rotatie` schuift 'm één plek op in de pool, zodat opeenvolgende klassement-
 *  bezoeken door de knievallen cyclen i.p.v. altijd dezelfde te tonen (#535).
 *  Bij gelijke (seed, rotatie) blijft de uitkomst stabiel — geen geflikker. */
export function coachBuiging(seed: string, rotatie = 0): string {
  return kiesUniek(BUIGING, roastSeed("buiging", seed) + rotatie);
}

/**
 * Kleurt een feitelijke observatie met de commentator-toon op het gekozen
 * niveau. Schild aan → het kále feit (neutrale variant, geen sneer). `seed`
 * (bv. hash van playerId + periode) kiest deterministisch de sneer, zodat de
 * hele groep dezelfde burn ziet.
 */
export function kleurRoast(feit: string, ctx: RoastCtx, seed: number): string {
  return feit + sneerSuffix(ctx, seed);
}

/** Leidt de roast-context af uit de groep + het doelwit-profiel. Ontbrekende
 *  velden vallen terug op de DB-defaults (gemeen / schild neer). */
export function roastCtx(
  group: Pick<Group, "roast_intensiteit"> | null | undefined,
  target: Pick<Profile, "roast_schild"> | null | undefined,
): RoastCtx {
  return {
    intensiteit: group?.roast_intensiteit ?? "radioactief",
    schild: target?.roast_schild ?? false,
  };
}

/** Kleine stabiele hash (djb2), voor een deterministische seed uit bv.
 *  playerId + periode. */
export function roastSeed(...delen: string[]): number {
  let h = 5381;
  const s = delen.join("|");
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return h;
}
