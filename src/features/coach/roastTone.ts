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
  ],
  gemeen: [
    "Pijnlijk om te zien. Zelfs het publiek keek collectief weg.",
    "Was dit padel of een wanhopige poging tot moderne dans?",
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
    "Mijn oma plays met een houten pollepel nog een betere bandeja dan dit gedrocht.",
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
    "Sommige spelers hebben talent, others hebben gewoon een heel mooi padelshirt.",
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
    "Mijn notitieboekje is uit pure frustratie uit m'n handen gesprongen en ligt nu in de vuilnisbak.",
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
  ],
  gemeen: [
    "Fenomenaal! Ik heb er al twee pagina's over volgeschreven in m'n notitieboekje, allemaal met uitroeptekens.",
    "Dit was van WK-niveau. En dan bedoel ik de kant die wél kon spelen.",
    "Bravo. Hier had ik in 2011 bij Lille van gedroomd.",
    "Schitterend! Ik sta hier langs de lijn te klappen in m'n chique pak.",
    "Meesterlijk. Dit zet ik naast m'n eigen tactische masterplans in de kast.",
    "Pure klasse. Zelfs bij Napoli heb ik zoiets niet gezien, en daar zat talent.",
    "Subliem! M'n notitieboekje kan de lof amper bijhouden.",
    "Wat een vertoning! Ik heb m'n pet afgenomen en ben vergeten hem weer op te zetten.",
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
  ],
} as const;

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
  "Neem me niet kwalijk, Generaal Mbappé. Ik hou m'n grote mond en schrap de kebabs van de menukaart. 🙇",
  "Geen sneer vandaag. Als de Madrid-Dictator eist dat we buigen, dan buigen we. Ik wil niet uit de groepsapp gegooid worden. 🫡",
  "Ik zwijg. Ik wil geen brief van de advocaten van de dictator op m'n mat krijgen. Volk, op de knieën! 🙇",
  "Transfer-veto's en absolute macht... tegen de Generaal zeg ik geen woord. Buigen, jij daar! 🫡🙇",
] as const;

/** Kruiperige buig-regel voor de troon; deterministisch per seed (speler-key /
 *  de vaste Mbappé-seed), zodat hij vast staat per dictator maar varieert. */
export function coachBuiging(seed: string): string {
  return kiesUniek(BUIGING, roastSeed("buiging", seed));
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
    intensiteit: group?.roast_intensiteit ?? "gemeen",
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
