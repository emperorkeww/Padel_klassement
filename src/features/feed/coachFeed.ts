// Coach Rudy in de feed (#183): de commentator reageert op de sáppige
// gebeurtenissen — pias van de week/maand, kampioenen, promoties/degradaties en
// matches met een upset, bagel, monsterzege of winreeks. Mundane items (polls,
// vriendschappen, groepsnieuws) laat hij bewust links liggen, anders wordt de
// feed ruis. Bij de prestaties (kampioen, promotie, winreeks, upset-winst) wisselt
// hij af tussen een jab en oprechte hype (#199) — de seed beslist, zodat het per
// event vastligt. Alles deterministisch geseed zodat de hele groep dezelfde quip
// ziet; roast-quips respecteren de groepsintensiteit en het roast-schild.
// Pure functie, getest in coachFeed.test.ts.

import type { FeedEvent, Highlight } from "@/features/feed/feedLogic";
import type { Match, Profile, RoastIntensiteit, Team } from "@/types";
import type { CoachMood, RoastCtx } from "@/features/coach/roastTone";
import {
  coachLof,
  coachSneer,
  kiesUniek,
  roastCtx,
  roastSeed,
} from "@/features/coach/roastTone";
import {
  isWinreeksRecord,
  piasNrDezeMaand,
  verliesFeiten,
  type VerliesFeiten,
} from "@/features/coach/coachStats";
import { playersOf } from "@/features/rating/results";

export interface CoachCtx {
  /** Roast-toon per groep. */
  intensiteitVoor: (groupId: string) => RoastIntensiteit;
  /** Profielen (voor het roast-schild van het doelwit). */
  profiles: Record<string, Profile>;
  /** Teams, nodig om bij match-roasts het verliezende team op shields te checken. */
  teams?: Record<string, Team>;
  /** Al gebruikte quips binnen deze weergave; voorkomt dubbele lijnen in de
   *  zichtbare feed. Geef één gedeelde set mee aan alle items van één render. */
  gebruikt?: Set<string>;
  /** Volledige (recente) matchlijst → stats-bewuste match-quips (#200). Ontbreekt
   *  hij, dan valt Coach Rudy terug op zijn generieke pools. */
  matches?: Match[];
  /** Weergavenaam van een speler, voor de rivaal-quip (#200). Zonder resolver
   *  valt hij terug op het id. */
  naamVoor?: (id: string) => string;
  /** Aangeduide pias-van-de-week per groep → herhaling ("Nde pias deze maand"). */
  piasWeeks?: { playerId: string; weekStart: string }[];
}

// beperkt, want het is commentaar op een gebeurtenis, geen persoonlijke sneer.
export const KAMPIOEN = [
  "Kampioen. Geniet ervan — het duurt nooit lang.",
  "De beker is voor jou. Maar laten we eerlijk zijn: de loting zat ook wel héél erg mee.",
  "Gefeliciteerd! Zelfs een blinde kip vindt wel eens een graantje.",
  "Kampioen! Nu nog leren hoe je een fatsoenlijke vibe opzet in de groepsapp.",
  "De koning van de club. Geniet van je 15 minutes of fame.",
  "Kampioen! Je ego heeft officieel z'n eigen postcode nodig.",
  "De beker is voor jou. De rest slijpt al de messen.",
  "Applaus. Verdiend. Voor nu.",
  "De troon is van jou. Tot iemand 'm afpakt.",
  "Kampioen! Zet 'm snel in de vitrine.",
  "Chapeau. Nu nog een keer, dan geloof ik het.",
  "De besten winnen. Vandaag was jij dat.",
  "Genieten van de top: mooi uitzicht, diepe val.",
  "De beker glimt, maar je reputatie heeft nog heel wat werk nodig.",
  "Eén zwaluw maakt de zomer niet, en één titel maakt je nog geen legende.",
  "Een schitterende titel! Die mag je trots naast mijn tactische masterplans in de kast zetten.",
  "Kampioen! De champagne staat koud, al had ik persoonlijk liever gezien dat je die pas na een zwaarbevochten 89e minuut had geopend.",
  "Kampioen! Nu nog leren hoe je een fatsoenlijke fles champagne ontkurkt zonder de glazen wanden van de kooi te slopen.",
  "Gefeliciteerd. Maar we weten allemaal dat je partner 90% van het tactische en fysieke zware werk heeft opgeknapt.",
  "Kampioen! Een werkelijk historische overwinning, heel legaal en heel cool. Iedereen zegt het.",
  "Kampioen! De rest van de divisie is corrupt en incompetent, alleen wij verdienen deze enorme glorie.",
  "Kampioen! Geniet van je beker, al vermoed ik dat de glazenwasser er meer werk aan heeft gehad dan jij op de baan.",
  "Kampioen! De champagne mag vloeien, al had ik er liever zelf gestaan.",
  "De beker is binnen. De legende begint nu pas echt.",
  "Kampioen! Een tactische triomf die nog jaren besproken zal worden.",
  "Bovenaan de troon. M'n notitieboekje heeft er een gouden randje bij gekregen.",
  "De absolute nummer één. Heel de club buigt voor je.",
  "Kampioen! Ik zet m'n sportpet er drie keer voor schuin.",
  "De beker glinstert, maar jouw servicetechniek is nog steeds van bedenkelijk niveau.",
  "De ultieme bekerwinnaar! Ik laat je stats in goud graveren.",
  "Kampioen! Geniet van deze glorie, want het is keihard werken om hier te blijven.",
  "De rest of de club kijkt met snotterige gezichten omhoog naar de kampioen.",
  "De absolute top bereikt. Zelfs Gianni Infantino stuurt felicitaties.",
] as const;

const PROMOTIE = [
  "Omhoog! Maar hoogmoed komt vlak vóór de degradatie.",
  "Een divisie hoger. Bereid je voor op een flinke dosis nederigheid.",
  "Gepromoveerd! Nu kun je op een hoger niveau afgedroogd worden.",
  "Welkom bij de grote jongens. Hopelijk heb je een goed vangnet.",
  "Stijgen is makkelijk. Blijven is de kunst... en kunst is niet jouw sterkste kant.",
  "Een stapje omhoog op de ladder. Kijk uit dat je niet duizelig wordt.",
  "Een divisie hoger. Adem de ijle lucht in, het went snel.",
  "Stijgen is makkelijk. Blijven is de kunst.",
  "Promotie! Nu de verwachtingen nog waarmaken.",
  "Naar boven. Vergeet de onderburen niet.",
  "Netjes geklommen. Niet naar beneden kijken.",
  "Een trede hoger op de ladder. Hij wiebelt wel.",
  "Opgeklommen. De lucht daarboven is dun.",
  "Welkom in de nieuwe divisie. Geniet van je eerste match, want daarna ga je hard omlaag.",
  "Omhooggevlogen! Hopelijk heb je je parachute bij je.",
  "Gepromoveerd! Een uitstekende transitie, bijna net zo vloeiend als mijn omschakelingsmomenten op het WK.",
  "Een niveau omhoog! Zorg er wel voor dat je daar boven ook fatsoenlijk kan serveren, anders lig je er zo weer uit.",
  "Promotie! Geniet van de uiterst tijdelijke roem voordat je hierna weer keihard naar beneden lazert.",
  "Een trede omhoog op de ladder. Nu kun je op een nog chiquer niveau genadeloos afgedroogd worden.",
  "Promotie! Net zo omstreden als het besluit van de FIFA-disciplinaire commissie om Baloguns rode kaart voorwaardelijk op te schorten.",
  "Promotie! Dit succes is enorm, gigantisch, het mooiste wat deze club ooit heeft gezien. Geloof me.",
  "Promotie! Een trede omhoog op de ladder, zodat je val strakjes nóg spectaculairder en pijnlijker zal zijn.",
  "Promotie! Een trede omhoog op de ladder van roem en zweet.",
  "Omhooggevlogen. Zorg dat je daarboven ook je mannetje kunt staan.",
  "Promotie! De tegenstanders op het nieuwe niveau zijn al zenuwachtig.",
  "Een niveau gestegen. Tijd om het tactische bord opnieuw in te richten.",
  "Stijgen is prachtig. Nu bewijzen dat je daar thuishoort.",
  "Promotie! Geniet van het uitzicht daarboven voordat je er met een rotgang vanaf dondert.",
  "Naar het hogere niveau! Tijd voor m'n chique pak en een extra spiekbriefje.",
  "Promotie! Een trede hoger op de ladder, nu de rest nog overklassen.",
  "Omhooggevlogen. Zorg dat je op het nieuwe niveau ook standhoudt.",
  "Gepromoveerd! Tijd om het tactische bord weer tevoorschijn te toveren.",
] as const;

const DEGRADATIE = [
  "Een divisie lager. De zwaartekracht wint altijd.",
  "Dalende lijn. Ik zou maar gaan trainen, of overstappen op minigolf.",
  "Gedegradeerd. Aan de andere kant: lager dan dit kun je bijna niet zinken.",
  "Terug naar af. Zelfs de zwaartekracht schrok van dit tempo.",
  "Glijbaan naar beneden. Neem je zwembandjes mee.",
  "Onderin is het ook gezellig, zeggen ze. Veel succes daar.",
  "Dalende lijn. Ik zou maar gaan trainen.",
  "Terug naar af. Gebeurt de besten. En jou dus ook.",
  "Naar beneden. De vertrouwde bodem lonkt.",
  "Gedegradeerd. Warm maar op voor de terugkeer.",
  "Een trede lager. Het went vanzelf.",
  "Zakken gaat snel. Klimmen duurt eeuwen.",
  "Afgezakt. De onderbuurman heet nu 'jij'.",
  "Glijbaan naar de kelderklasse. Daar is het bier tenminste koud.",
  "Een divisie gezakt. Misschien kun je daar wel eens een bal raken?",
  "Degradatie! Net zo pijnlijk als een vroege uitschakeling in de groepsfase. Maar goed, we geven gewoon de scheidsrechter de schuld.",
  "Omlaag gekelderd. Misschien moet je je tactiekbord eens een kwartslag draaien, wie weet helpt het.",
  "Gedegradeerd! Geeft absoluut niks, in de kelderklasse hebben ze tenminste geen al te hoge verwachtingen van je.",
  "Dalende lijn. Misschien moet je je tactiekbord eens omdraaien; het lijkt erop dat je de pijlen de verkeerde kant op had getekend.",
  "Degradatie. Zelfs met hulp van Gianni Infantino en presidentiële steun lig je er nu gewoon genadeloos uit.",
  "Degradatie. Een complot van de bond en de tegenstanders. We gaan in beroep bij de FIFA.",
  "Degradatie. Gefeliciteerd met je terugkeer naar de kelderklasse. Daar hoef je tenminste niet te doen alsof je kunt spelen.",
  "Degradatie. Een tactische heroriëntatie is dringend noodzakelijk.",
  "Een divisie gezakt. M'n notitieboekje huilt zachtjes met je mee.",
  "Omlaag. Hopelijk vind je daar de motivatie om weer te gaan trainen.",
  "Degradatie. Maar wie onderop ligt, kan alleen nog maar omhoog kijken.",
  "Teruggezakt. Laat deze afgang de brandstof zijn voor je comeback.",
  "Degradatie. Zelfs m'n viool speelt er een droevig deuntje bij.",
  "Een stap omlaag. De terreinknecht staat al klaar om de kelder voor je te vegen.",
  "Gedegradeerd. Terug naar de basis, en vooral heel veel trainen.",
  "Dalende lijn. Ik schrijf me weer helemaal suf over deze val.",
  "Een divisie gezakt. Zelfs m'n viool speelt een droevig melodietje.",
] as const;

const REEKS = [
  "Niet meer te stoppen, die. Voorlopig.",
  "Op dreef! Iemand moet er een stok tussen steken.",
  "Reeks na reeks. Geniet, till de harde klap komt.",
  "Een winstreak? Dat is puur statistisch toeval, geniet er maar van.",
  "Onverslaanbaar? Laat me niet lachen, je hebt gewoon geluk met je partners.",
  "De winning streak groeit. De arrogantie helaas ook.",
  "Reeks na reeks. Geniet, tot de klap komt.",
  "Losgeslagen. Iemand een emmer koud water?",
  "Winst op winst. Verslavend, hè.",
  "Onstuitbaar. Tot de statistiek terugslaat.",
  "De machine draait. Onderhoud niet vergeten.",
  "Reeks aan de gang. Geniet zolang het duurt.",
  "Winst na winst. Begint het al saai te worden voor de toeschouwers?",
  "Op een wolk! Pas op dat je er niet in één keer vanaf dondert.",
  "Wat een overwinningsreeks! Heb je stiekem de tactiek van de Spanjaarden gekopieerd?",
  "Nog steeds aan het winnen. Ik heb in mijn notitieboekje gezocht naar een tactische verklaring, maar kon niks vinden.",
  "Een winreeks! Zelfs de meest incapabele bondscoach zou dit niet meer durven verkloten.",
  "Winst op winst. Heb je stiekem de banen korter laten maken of de netten verlaagd?",
  "Een ongekende reeks. Zelfs de analisten staan met de mond vol tanden.",
  "Winst na winst. Je bent momenteel de schrik van de hele groepsapp.",
  "De overwinningsreeks groeit. Heel de club praat erover.",
  "Onstuitbare vorm. Blijf gefocust, de top kijkt met angst toe.",
  "Reeks na reeks. Een demonstratie van tactische discipline en pure wilskracht.",
  "Onverslaanbaar! De tegenstanders overwegen al om niet meer op te komen.",
  "Een winstreeks van jewelste. M'n notitieboekje glinstert van de positieve stats.",
  "Een winreeks om van te dromen. Blijf scherp, de concurrentie loert.",
  "Onstuitbaar! De machine draait op volle toeren.",
  "Winst op winst. M'n notitieboekje raakt oververhit door je vorm.",
] as const;

// Bounty geclaimd (#805): de leider betaalde de prijs op z'n hoofd. Spot met
// hém, dus alleen als de verliezers geen roast-schild dragen.
const BOUNTY_GECLAIMD = [
  "De prijs op zijn hoofd is geïnd. Iemand moest die arrogante kop een toontje lager laten zingen.",
  "Kroon af, kassa open. Het feestje aan de top is voorbij, terug in je hok.",
  "De koning betaalt. Contant, in Elo en met een flinke deuk in z'n zogenaamde trots.",
  "Dat is het probleem met bovenaan staan: iedereen weet waar je woont en iedereen wil je slopen.",
  "Premie geïnd. De jacht was geopend en de jacht is geslaagd. Einde van het neppartijtje.",
  "Zijn ongeslagen reeks ligt in de kooi. Naast zijn waardigheid en z'n kapotte racket.",
  "De bounty is uitbetaald. Zijn ego staat nog dieper in de min dan z'n banksaldo.",
  "Wie bovenaan staat wordt bejaagd. Vandaag was het raak en ging de koning vakkundig met de billen bloot.",
  "Daar gaat de buit. Hij mag de Elo zelf overhandigen op z'n knieën.",
  "De leider is afgerekend. Letterlijk. Geen smoesjes over racketspanning vandaag.",
  "Het hoofd van de klas krijgt een rekening gepresenteerd. En de rente was torenhoog.",
  "Een reeks opbouwen duurt weken. Hem verliezen duurde één setje vol tactisch geklungel.",
  "Eindelijk is die nep-koning van z'n troon gepleurd. De premiejagers drinken vanavond gratis bier van zijn geplunderde Elo.",
  "De bounty is geïnd! Zelfs Gianni Infantino kon deze diefstal niet meer voorwaardelijk opschorten.",
  "De koploper heeft betaald. Contant, in tranen en in keiharde Elo-punten. Dag status, hallo schaamte.",
  "Het zat er al weken aan te komen: de leider is vakkundig geslacht. Z'n reeks ligt in gruffels langs de kooi.",
  "Daar gaat de prijs op z'n hoofd. Nu kan die arrogante kop ook weer gewoon door de deur van de kantine.",
  "Bounty geclaimd. Hij liep rond met een schietschijf op z'n rug en de tegenstanders hebben 'm met sadistisch genoegen doormidden geknald.",
  "Z'n kroon ligt in de modder. De jacht is geslaagd en de buit is binnen. Ga je diep schamen op veld 3.",
  "De leider is afgeschminkt. Die zogenaamde heerschappij was net zo nep als m'n Napoli-contract.",
] as const;

// Bounty verdedigd (#805): niemand kreeg de vaste pool te pakken.
const BOUNTY_VERDEDIGD = [
  "Bounty overleefd. Het bedrag op z'n hoofd blijft staan omdat jullie te laf of te incapabel zijn om 'm te pakken.",
  "Weer niemand die 'm pakt. De premie blijft liggen. Hebben jullie eigenlijk wel met jullie ogen open gespeeld?",
  "De jacht is geopend en de jacht is mislukt. Volgende stelletje amateurs graag.",
  "Premiejagers afgeslagen. Ze mogen het volgende week opnieuw proberen, hopelijk met een betere forehand dan deze ellende.",
  "Nog steeds de baas, nog steeds een premie waard, en nog steeds omringd door spelers die geen deuk in een pakje boter slaan.",
  "De troonopvolger blijft opvolger. Al weken. Wat een bende angsthazen hier.",
  "Hij loopt er rustig mee weg met die prijs op z'n hoofd, terwijl jullie met open mond toekijken.",
  "Iedereen wist wat er te halen viel. Niemand haalde het. Wat een collectief gebrek aan kwaliteit.",
  "De bounty blijft staan. Op een dag pakt iemand die premie, maar als jullie zo blijven prutsen duurt dat nog decennia.",
  "Aanval afgeslagen. De koning slaapt vannacht prima, wetende dat de uitdagers de loopsnelheid van een zwangere slak hebben.",
  "Weer niks te halen voor de prutsers. De bounty blijft gewoon op z'n hoofd glimmen.",
  "De zogenaamde premiejagers kwamen met grote praatjes, maar dropen met de staart tussen de benen af. De bounty staat nog steeds.",
  "De koning lacht jullie vierkant uit. Niemand die dat geld op z'n hoofd durft te pakken. Wat een bende.",
  "Nog steeds niemand met genoeg ballen om die premie op te eisen? M'n notitieboekje staat vol met jullie mislukte pogingen.",
  "De bounty groeit en groeit. Blijkbaar heeft de rest van de club de loopsnelheid van een standbeeld.",
  "Premie overleefd. De koploper veegt z'n schoenen af aan jullie zogenaamde tactische plannen.",
  "Het bedrag op z'n hoofd stijgt. Jullie durven wel te typen in de groepsapp, maar op de baan zijn jullie zo mak als lammetjes.",
  "Weer een mislukte staatsgreep. De dictator blijft stevig in het zadel en de premie blijft onaangeraakt.",
  "Bounty verdedigd. De uitdagers speelden alsof hun rackets van natte kranten waren gemaakt. Kansloos.",
] as const;

const UPSET = [
  "Daar gaan de favorieten. Héérlijk om te zien.",
  "Papieren favorieten, opgelet: het papier scheurt.",
  "De underdog bijt. Wie had dát gedacht.",
  "Een sensatie! De favorieten waren blijkbaar al met hun hoofd bij het bier.",
  "Rechtstreeks de geschiedenisboeken in als de blunder van de week.",
  "David verslaat Goliath. Goliath moet zich diep gaan schamen.",
  "Voorspelling de prullenbak in. Prachtig.",
  "De outsider slaat toe. Kassa.",
  "Zoveel voor de papieren vorm.",
  "David 1, Goliath 0. Klassieker.",
  "De favoriet struikelt over z'n eigen ego.",
  "De favorieten liggen in de kooi te huilen. Wat een heerlijke avond.",
  "Wie de toto op hen had gezet is nu rijk. Maar niemand deed dat natuurlijk.",
  "Een totale verrassing! De favorieten stonden erbij alsof ze tactisch volledig buitenspel gezet waren.",
  "Wat een stunt! Dit had zelfs de meest optimistische voetbalanalist niet durven voorspellen.",
  "Underdog pakt de zege! De favorieten stonden erbij en keken ernaar alsof ze mijn persconferenties live moesten vertalen.",
  "Voorspelling compleet aan diggelen. Een pijnlijk tactisch debacle voor de topfavoriet.",
  "Underdog wint! Dit is het grootste sportieve en organisatorische schandaal sinds de toewijzing van het WK aan Qatar.",
  "Upset! De outsider wint door een beslissing die nog onbegrijpelijker is dan de opschorting van Baloguns rode kaart.",
  "Upset! De topfavoriet ging volledig op z'n bek. Een tactisch debacle van historisch formaat.",
  "De underdog wint! Een tactisch meesterwerk dat alle voorspellingen tart.",
  "Upset! De favorieten dachten dat het een makkelijke middag zou worden. Fout.",
  "Een stunt van formaat. De ranglijst staat volledig op z'n kop.",
  "De favoriet ging eraf met een tactische blunder die z'n weerga niet kent.",
  "Upset! Heel de toto in duigen, behalve voor wie in dit wonder geloofde.",
  "Wat een stunt! De favorieten stonden erbij alsof ze ter plekke aan de grond genageld waren.",
  "Underdog wint! Dit schudt de ranglijst weer eens lekker op.",
  "Sensatie op de baan! De underdog deelt een gigantische klap uit.",
  "Underdog wint! Dit schudt het hele klassement weer lekker op.",
  "De favoriet ging vakkundig op z'n bek. Wat een avond.",
] as const;

const BAGEL = [
  "Een droge 6-0. Nul games. Iemand mag zich diep schamen.",
  "6–0. Dat is geen wedstrijd, dat is een openbare terechtstelling.",
  "Pandoering gekregen. Droge 6-0. Koud opgediend.",
  "Een droge 6-0... Hebben jullie überhaupt wel je rackets uit de tas gehaald?",
  "Nul komma nul. Zelfs het scorebord schaamde zich om dit te tonen.",
  "Fietsbandjes uitgedeeld. Tijd voor een flinke portie zelfreflectie.",
  "Nul. Helemaal niks. Autsj.",
  "Een rondje nul. Bewaar 'm goed.",
  "Blank gehouden. Wreed maar mooi.",
  "Niet één gametje. Dat vergeet de groep nooit.",
  "6–0. De genadeloze klassieker.",
  "6–0. Zelfs de kantinejuffrouw vroeg of jullie eigenlijk wel meededen.",
  "Nul games. Dat is statistisch gezien bijna moeilijker dan één game winnen.",
  "Een droge 6-0! Zelfs met een vijfvoudige tactische wissel was dit niet minder pijnlijk geweest.",
  "Helemaal van de kaart geveegd. Mijn aantekeningen over deze set passen gemakkelijk op een postzegel.",
  "6-0! Een droge afschminking. Zelfs met een blinde wissel in de 89e minuut had ik dit niet slechter gekund.",
  "Nul games gepakt. Dat is statistisch gezien bijna een indrukwekkende kunstvorm op zich.",
  "6-0! Een droge afstraffing die de tegenstander nog lang zal heugen.",
  "Bagel uitgedeeld! De tegenpartij mocht alleen maar toekijken.",
  "6-0 winst. Een masterclass in absolute dominantie aan het net.",
  "Nul games weggegeven. Efficiënter dan dit wordt het niet.",
  "6-0! De glazen wanden trillen nog na van deze vernedering.",
  "6-0 winst! Een perfecte set waarbij de tegenstander alleen als toeschouwer fungeerde.",
  "Droge bagel uitgedeeld. Zelfs de scheidsrechter hoefde nauwelijks op te letten.",
  "6-0! Een droge bagel. Iemand mag direct strafrondjes gaan lopen.",
  "Nul games weggegeven. Een absolute demonstratie van klasse.",
  "6-0 winst. Efficiënter dan dit wordt padel niet.",
] as const;

const MONSTER = [
  "Meedogenloos afgemaakt. Prachtig wreed.",
  "Dat was geen partij, dat was een statement.",
  "Genadeloos. De coach knikt goedkeurend.",
  "Vernedering met een grote V. Ze wisten niet eens waar de bal was.",
  "Een walkover van jewelste. Was de tegenstander wel aanwezig?",
  "Vleesmolen-padel. Geen spaan heel gelaten van de tegenpartij.",
  "Weggespeeld. Zonder pardon.",
  "Een pak slaag om in te lijsten.",
  "Deed pijn om te zien. Op de goede manier.",
  "Compleet ingemaakt. Zo hoort dat.",
  "De sloophamer erin. Effectief.",
  "Dat was geen wedstrijd, dat was een openbare les in nederigheid.",
  "Sloopwerkzaamheden op baan 1. Geen spaan heel gelaten van de tegenpartij.",
  "Een slachting! Dat is het soort meedogenloze overgangsspel dat we op het WK hadden moeten laten zien.",
  "Geen spaan heel gelaten. Dit niveau van dominantie is bijna onbeschoft, ik hou er wel van.",
  "Een walkover! Zelfs mijn meest beruchte tactische WK-moderampen vallen in het niet bij deze totale slachting.",
  "Dat was geen wedstrijd, dat was een openbare executie. Ik noteer 'm met gepast sadistisch genoegen.",
  "Een monsterzege! De tegenstander werd volledig overlopen.",
  "Dominantie met hoofdletters. Geen spaan heel gelaten.",
  "Een pak slaag van jewelste. Tactisch en fysiek volledig overklast.",
  "Monsterzege! De cijfers spreken voor zich: absolute klasse.",
  "Weggevaagd. Dit niveau van overmacht is bijna angstaanjagend.",
  "Een ware slachting in de kooi. Geen genade getoond.",
  "Monsterzege! Tactisch en fysiek een volkomen overklassing.",
  "Monsterzege! De tegenstander werd volledig overlopen.",
  "Geen spaan heel gelaten. Tactisch en fysiek superieur.",
  "Walkover! Dat was geen wedstrijd, dat was een les.",
] as const;

const DEGRADATIE_NEUTRAAL = [
  "Een divisie lager. Tijd om rustig opnieuw op te bouwen.",
  "Gezakt in het klassement. De volgende match telt weer.",
  "Een stap terug in de stand.",
  "De lijn ging omlaag, maar het seizoen loopt door.",
  "Stap omlaag. De volgende match is een nieuwe kans om te klimmen.",
  "Een divisie omlaag gezakt, maar de competitie is nog lang niet gestreden.",
  "Gezakt in de stand. Focus op de volgende match om te herstellen.",
  "Een stapje terug. De weg omhoog is de enige optie.",
] as const;

const BAGEL_NEUTRAAL = [
  "6–0. Duidelijke uitslag, snel door naar de volgende.",
  "Een eenzijdige set. De cijfers zijn helder.",
  "Nul games op het bord. Volgende match nieuwe kans.",
  "Broodje bal op papier, neutraal genoteerd.",
  "Nul games gepakt. Snel vergeten en focussen op de volgende set.",
  "Eenzijdig resultaat op papier. Tijd voor een tactische heroriëntatie.",
  "Eenzijdig resultaat. Snel omschakelen naar het volgende potje.",
  "Nul games op het bord, tijd voor een nieuwe start.",
] as const;

function heeftSchild(profile: Profile | undefined): boolean {
  return profile?.roast_schild ?? false;
}

function verliezersHebbenSchild(event: Extract<FeedEvent, { kind: "match" }>, ctx: CoachCtx): boolean {
  const teams = ctx.teams;
  if (!teams || !event.match.winner_team_id) return false;
  const loserTeamId =
    event.match.winner_team_id === event.match.team_a_id
      ? event.match.team_b_id
      : event.match.team_a_id;
  const loser = teams[loserTeamId];
  if (!loser) return false;
  return playersOf(loser).some((id) => heeftSchild(ctx.profiles[id]));
}

/**
 * Het schild van de gevierde speler(s) bij een positief match-event (#199): bij
 * een winreeks de speler zelf, bij een duo-reeks of een upset het hele winnende
 * team. Bepaalt of Coach Rudy's hype op mild getemperd wordt — anders dan
 * verliezersHebbenSchild, dat over de verliezende kant gaat en bepaalt of hij
 * überhaupt mag spotten.
 */
function hypeDoelwitHeeftSchild(
  event: Extract<FeedEvent, { kind: "match" }>,
  ctx: CoachCtx,
): boolean {
  const teams = ctx.teams ?? {};
  const teamHeeftSchild = (teamId: string): boolean => {
    const team = teams[teamId];
    return team ? playersOf(team).some((id) => heeftSchild(ctx.profiles[id])) : false;
  };
  for (const h of event.highlights) {
    if (h.type === "streak" && heeftSchild(ctx.profiles[h.playerId])) return true;
    if (h.type === "duo" && teamHeeftSchild(h.teamId)) return true;
    if (h.type === "upset" && teamHeeftSchild(h.winnerTeamId)) return true;
  }
  return false;
}

/**
 * Kiest Coach Rudy deze keer voor hype i.p.v. een jab? Het schild geeft altijd
 * lof (geen ongevraagde spot), en verder wisselt de seed deterministisch af, zodat
 * hij bij positieve gebeurtenissen soms juicht en soms prikt — maar per event
 * altijd hetzelfde, voor de hele groep.
 *
 * De keuze-bit wordt bewust uit een gemengde kopie van de seed gehaald i.p.v. uit
 * `seed % 2`: kiesUniek pakt zijn index met `seed % pool.length`, dus zou de
 * laagste bit hier beslissen, dan pinde die meteen de pariteit van die index vast
 * en bleef bij een pool van even lengte de helft van de regels onbereikbaar.
 */
function hypeBeurt(lofCtx: RoastCtx, seed: number): boolean {
  return lofCtx.schild || ((Math.imul(seed, 0x9e3779b1) >>> 16) & 1) === 0;
}

/** De hype-context van een positief match-event: de toon van de groep waarin de
 *  match viel, getemperd door het schild van de gevierde speler(s). */
function matchLofCtx(
  event: Extract<FeedEvent, { kind: "match" }>,
  ctx: CoachCtx,
): RoastCtx {
  return {
    intensiteit: ctx.intensiteitVoor(event.match.group_id ?? ""),
    schild: hypeDoelwitHeeftSchild(event, ctx),
  };
}

/**
 * Commentaar bij een klim of val op de ladder — deelt de logica van de rank- en
 * tier-events. Omhoog is een prestatie, dus daar juicht of prikt Coach Rudy
 * (#199); omlaag blijft een afgang, met de neutrale variant bij een schild.
 * Beide events dragen geen groupId, vandaar de lege sleutel: de feed hanteert
 * toch jouw eigen profiel-intensiteit (zie Feed.tsx).
 */
function klimOfVal(omhoog: boolean, playerId: string, seed: number, ctx: CoachCtx): string {
  const lofCtx = roastCtx(
    { roast_intensiteit: ctx.intensiteitVoor("") },
    ctx.profiles[playerId],
  );
  if (omhoog) {
    return hypeBeurt(lofCtx, seed)
      ? coachLof(lofCtx, seed, ctx.gebruikt)
      : kiesUniek(PROMOTIE, seed, ctx.gebruikt);
  }
  return kiesUniek(lofCtx.schild ? DEGRADATIE_NEUTRAAL : DEGRADATIE, seed, ctx.gebruikt);
}

/** NL-ordinaal ("3e"). */
const ordinaal = (n: number): string => `${n}e`;

/** Kiest deterministisch één feit-lijn (of null als er geen bruikbaar feit is,
 *  waarna de aanroeper op de generieke pool terugvalt). Respecteert `gebruikt`
 *  zodat de zichtbare feed geen dubbele lijn toont. */
function kiesFeit(kandidaten: string[], seed: number, g?: Set<string>): string | null {
  if (kandidaten.length === 0) return null;
  return kiesUniek(kandidaten, seed, g);
}

/** Feit-lijnen bij een bagel-nederlaag (loser-perspectief). */
function bagelFeiten(vf: VerliesFeiten | null): string[] {
  if (!vf) return [];
  const l: string[] = [];
  if (vf.bagelNr && vf.bagelNr >= 2) {
    l.push(`Een droge 6-0 — en al je ${ordinaal(vf.bagelNr)} nul-nummer deze maand. Zwak.`);
    l.push(`Alweer een droge 6-0? Dat is al je ${ordinaal(vf.bagelNr)} deze maand. Misschien moet je een bakkerij beginnen.`);
  }
  if (vf.nederlaagNr && vf.nederlaagNr >= 3) {
    l.push(`6–0, en dat is je ${ordinaal(vf.nederlaagNr)} nederlaag deze maand. De maand is niet eens om.`);
    l.push(`Al je ${ordinaal(vf.nederlaagNr)} nederlaag deze maand en dan ook nog met een droge 6-0... Tactisch een totale moderamp.`);
  }
  if (vf.rivaal && vf.rivaal.count >= 3) {
    l.push(`Een droge 6-0 tegen ${vf.rivaal.naam}: de ${ordinaal(vf.rivaal.count)} nederlaag op rij tegen dezelfde man.`);
    l.push(`Alweer een droge 6-0 en al de ${ordinaal(vf.rivaal.count)} nederlaag op rij tegen ${vf.rivaal.naam}. Heeft hij soms een abonnement op jouw vernedering gekocht?`);
  }
  if (vf.record) {
    l.push("Nul games. De grootste afgang ooit — knap, op je eigen manier.");
    l.push("Een legendarische 6-0 afgang. Zelfs op het WK van 2026 heb ik zo'n totale instorting niet meegemaakt.");
  }
  return l;
}

/** Feit-lijnen bij een monsterzege (het puntenverschil + het leed van de verliezer). */
function monsterFeiten(vf: VerliesFeiten | null): string[] {
  if (!vf) return [];
  const l: string[] = [];
  const m = vf.marge;
  if (vf.record && m != null) {
    l.push(`${m} games verschil — een persoonlijk dieptepunt om in te lijsten.`);
    l.push(`${m} games verschil. Een historisch dieptepunt. Ik stel voor dat we deze match direct uit de database wissen om verdere schaamte te voorkomen.`);
  }
  if (vf.rivaal && vf.rivaal.count >= 3) {
    l.push(`Een pak slaag, en de ${ordinaal(vf.rivaal.count)} nederlaag op rij tegen ${vf.rivaal.naam}.`);
    l.push(`Alweer een pandoering, en dat is al de ${ordinaal(vf.rivaal.count)} nederlaag op rij tegen ${vf.rivaal.naam}. Wordt het niet eens tijd om een andere partner te zoeken?`);
  }
  if (vf.nederlaagNr && vf.nederlaagNr >= 3) {
    l.push(`Meedogenloos afgemaakt: je ${ordinaal(vf.nederlaagNr)} nederlaag deze maand.`);
    l.push(`Compleet weggespeeld. Al je ${ordinaal(vf.nederlaagNr)} nederlaag deze maand. Mijn notitieboekje raakt vol door jouw vormcrisis.`);
  }
  if (m != null) {
    l.push(`${m} games verschil. Dat was geen partij, dat was een statement.`);
    l.push(`${m} games verschil. Dat was geen wedstrijd, dat was een openbare executie. Ik noteer 'm met sadistisch genoegen.`);
  }
  return l;
}

/** Feit-lijnen bij een upset (winkans van de favoriet + een terugkerende rivaal). */
function upsetFeiten(
  event: Extract<FeedEvent, { kind: "match" }>,
  vf: VerliesFeiten | null,
  magRoasten: boolean,
): string[] {
  const l: string[] = [];
  const up = event.highlights.find((x) => x.type === "upset");
  if (up && up.type === "upset") {
    const kans = Math.round(up.chance * 100);
    l.push(`De favoriet onderuit, met ${kans}% winkans vooraf. Papieren vorm, de prullenbak in.`);
    l.push(`Als favoriet verliezen met ${kans}% winkans vooraf... Zelfs de bookmakers liggen in een deuk door deze wanprestatie.`);
  }
  if (magRoasten && vf?.rivaal && vf.rivaal.count >= 3) {
    l.push(`De ${ordinaal(vf.rivaal.count)} nederlaag op rij tegen ${vf.rivaal.naam} — en die was nota bene de underdog.`);
    l.push(`De ${ordinaal(vf.rivaal.count)} nederlaag op rij tegen underdog ${vf.rivaal.naam}. Misschien moeten we Gianni Infantino bellen om deze uitslag voorwaardelijk te laten opschorten.`);
  }
  return l;
}

/** Feit-lijnen bij een win- of duo-reeks (mijlpaal 3/5/10 uit de highlight). */
function reeksFeiten(event: Extract<FeedEvent, { kind: "match" }>, ctx: CoachCtx): string[] {
  const teams = ctx.teams ?? {};
  const l: string[] = [];
  const s = event.highlights.find((x) => x.type === "streak");
  if (s && s.type === "streak") {
    const record = ctx.matches ? isWinreeksRecord(ctx.matches, teams, s.playerId, s.count) : false;
    if (record) {
      l.push(`${s.count} zeges op rij — een persoonlijk record. Geniet, tot de klap komt.`);
      l.push(`${s.count} zeges op rij — een nieuw persoonlijk record. Heel legaal en heel cool, al weet ik zeker dat de klap hierna gigantisch zal zijn.`);
    } else {
      l.push(`${s.count} op rij. De machine draait, onderhoud niet vergeten.`);
      l.push(`${s.count} op rij gewonnen. Geniet van de uiterst tijdelijke roem voordat je weer keihard naar beneden lazert.`);
    }
  }
  const d = event.highlights.find((x) => x.type === "duo");
  if (d && d.type === "duo") {
    l.push(`${d.count} keer op rij als vast duo. Voorlopig niet te stoppen.`);
    l.push(`${d.count} keer op rij gewonnen als duo. Maar laten we eerlijk zijn: we weten allemaal dat je partner 90% van het werk opknapt.`);
  }
  return l;
}

/** Feit-lijnen bij een gespeelde match met lef (dubbel-of-niets multiplier). */
function lefFeiten(event: Extract<FeedEvent, { kind: "match" }>, ctx: CoachCtx): string[] {
  const l: string[] = [];
  const lefHighlights = event.highlights.filter((x) => x.type === "lef") as Extract<
    Highlight,
    { type: "lef" }
  >[];

  for (const h of lefHighlights) {
    const speler = ctx.naamVoor ? ctx.naamVoor(h.playerId) : h.playerId;
    const heeftLefSchild = heeftSchild(ctx.profiles[h.playerId]);

    if (h.won) {
      if (heeftLefSchild) {
        l.push(`${speler} speelde met lef en won. Keurig gedaan.`);
        l.push(`${speler} gokte met lef-multiplier en trok de winst over de streep.`);
      } else {
        l.push(`${speler} speelde met 'lef' en wint. Gefeliciteerd met je verdubbelde buit, al weet iedereen dat je partner 95% van het zware werk heeft gedaan.`);
        l.push(`Lef-multiplier succesvol voor ${speler}. Twee keer niks is nog steeds niks, maar de database rekent het toch goed.`);
        l.push(`Gokken als een bezetene en dan nog beloond worden ook. ${speler} pakt de dubbele winst, puur op geluk en de fouten van de tegenstander.`);
        l.push(`${speler} drukt op de 'lef'-knop en wint zowaar een keer. Ga nu niet direct een chic pak kopen, dit was pure mazzel.`);
        l.push(`Dubbel-of-niets uitgekeerd aan ${speler}. Zelfs een blinde goudvis zwemt wel eens per ongeluk tegen een voederkorf aan.`);
        l.push(`Met de forehand van een dronken tuinkabouter toch dubbele Elo pakken. ${speler} heeft vandaag alle wetten van de logica getart.`);
      }
    } else {
      if (heeftLefSchild) {
        l.push(`${speler} gokte op dubbel-of-niets maar verloor. Jammer.`);
        l.push(`${speler} zette zijn lef in maar moest helaas dubbel verlies slikken.`);
      } else {
        l.push(`${speler} dacht heel stoer te zijn met 'lef', maar levert nu met liefde dubbele Elo in. Een tactische blunder van historisch niveau.`);
        l.push(`Grootste mond van de club, de lef-knop indrukken, en dan zó hard afgedroogd worden. ${speler} staat officieel te kijk voor de hele vereniging.`);
        l.push(`Met lef spelen maar met de finesse van een omvallende koelkast. ${speler} verliest dubbel hard. Geniet van je vrije val in het klassement.`);
        l.push(`Dubbel verlies voor ${speler}. M'n notitieboekje trilt nog na van het lachen om deze monumentale zelfoverschatting.`);
        l.push(`${speler} wilde de grote bink uithangen met de multiplier. Nu twee keer zo hard de afgrond in. De ijskrabber voor de kelderklasse ligt klaar.`);
        l.push(`Lef getoond, maar helaas geen talent aanwezig. ${speler} verliest dubbel en mag de komende weken de ballen uit de bosjes vissen.`);
      }
    }
  }
  return l;
}

/**
 * Feit-lijnen bij een rank-event (#411): de plek en de sprong-grootte in plaats
 * van enkel het binaire omhoog/omlaag. `event.rank` kan 0 zijn als de speler
 * niet (meer) in de standings zit — dan geen feit en valt de aanroeper terug op
 * de generieke pool. Rank-events zijn globaal (feedLogic), dus de teksten
 * spreken neutraal over "het klassement".
 */
function rankFeiten(
  event: Extract<FeedEvent, { kind: "rank" }>,
  omhoog: boolean,
): string[] {
  if (event.rank <= 0) return [];
  const rank = event.rank;
  if (event.shift === "nieuw") {
    return [
      `Nieuw in het klassement, meteen op #${rank}. De lijst is gewaarschuwd.`,
      `Net binnengekomen op #${rank}. Ik heb een verse bladzijde aangebroken in m'n notitieboekje.`,
    ];
  }
  if (typeof event.shift !== "number") return [];
  const n = Math.abs(event.shift);
  const was = rank + event.shift;
  if (omhoog) {
    if (rank <= 3 && was > 3) {
      return [
        `De top-3 binnengestormd, op #${rank}. De gevestigde orde mag zich zorgen maken.`,
        `Van #${was} naar #${rank}: welkom in de top-3. Ik roep bijna een persconferentie bijeen.`,
      ];
    }
    return [
      `${n} plekken gestegen, nu #${rank}. De lift werkt dus wél.`,
      `${n} plekken omhoog, naar #${rank}. Zo klim je een klassement in, mensen.`,
    ];
  }
  if (rank > 3 && was <= 3) {
    return [
      `Uit de top-3 gekukeld, naar #${rank}. Het podium is onverbiddelijk.`,
      `Van #${was} naar #${rank}: de top-3 uitgevallen. M'n notitieboekje kraakte toen ik het opschreef.`,
    ];
  }
  return [
    `${n} plekken gezakt, naar #${rank}. De zwaartekracht heeft je gevonden.`,
    `${n} plekken omlaag, naar #${rank}. De statistieken vertellen geen sprookje.`,
  ];
}

/**
 * Coach Rudy's commentaar bij een feed-gebeurtenis, of null als hij zwijgt.
 * Match-quips zijn stats-bewust (#200): met de meegegeven matchlijst vult hij
 * concrete feiten in (marge, herhaling deze maand, rivaal-reeks, records) en
 * valt terug op de generieke pool zodra die data ontbreekt. Pias-quips lopen via
 * coachSneer (respecteert schild + intensiteit); de rest kiest uit een vaste
 * pool op de gebeurtenis-seed.
 */
export function coachOpmerking(event: FeedEvent, ctx: CoachCtx): string | null {
  const g = ctx.gebruikt;
  switch (event.kind) {
    case "maand-pias":
      return coachSneer(
        roastCtx(
          { roast_intensiteit: ctx.intensiteitVoor(event.groupId) },
          ctx.profiles[event.playerId],
        ),
        roastSeed(event.playerId, event.periodeLabel),
        g,
      );
    case "pias-week": {
      const sneer = coachSneer(
        roastCtx(
          { roast_intensiteit: ctx.intensiteitVoor(event.groupId) },
          ctx.profiles[event.playerId],
        ),
        roastSeed(event.playerId, event.weekStart),
        g,
      );
      if (!sneer) return null; // schild aan → Coach Rudy zwijgt
      // Herhaling (#200): "al je Nde pias deze maand" vóór de sneer.
      const nr = ctx.piasWeeks
        ? piasNrDezeMaand(ctx.piasWeeks, event.playerId, event.weekStart)
        : 0;
      return nr >= 2 ? `Al je ${ordinaal(nr)} pias deze maand. ${sneer}` : sneer;
    }
    case "zwarte-piet":
      return coachSneer(
        roastCtx(
          { roast_intensiteit: ctx.intensiteitVoor(event.groupId) },
          ctx.profiles[event.toPlayerId],
        ),
        roastSeed(event.toPlayerId, event.at),
        g,
      );
    case "season-champion": {
      const seed = roastSeed(event.playerId, event.seasonLabel);
      const lofCtx = roastCtx(
        { roast_intensiteit: ctx.intensiteitVoor(event.groupId) },
        ctx.profiles[event.playerId],
      );
      return hypeBeurt(lofCtx, seed)
        ? coachLof(lofCtx, seed, g)
        : kiesUniek(KAMPIOEN, seed, g);
    }
    case "rank": {
      // Spiegelt klimOfVal, maar met de rank-feiten (#411) vóór de generieke
      // pool: de plek en sprong-grootte zitten in het event en verdienen de
      // tekst. klimOfVal zelf blijft voor tier-events, die geen rank hebben.
      const omhoog =
        event.shift === "nieuw" ||
        (typeof event.shift === "number" && event.shift > 0);
      const seed = roastSeed(event.playerId, event.at);
      const lofCtx = roastCtx(
        { roast_intensiteit: ctx.intensiteitVoor("") },
        ctx.profiles[event.playerId],
      );
      if (omhoog) {
        if (hypeBeurt(lofCtx, seed)) return coachLof(lofCtx, seed, g);
        return kiesFeit(rankFeiten(event, true), seed, g) ?? kiesUniek(PROMOTIE, seed, g);
      }
      if (lofCtx.schild) return kiesUniek(DEGRADATIE_NEUTRAAL, seed, g);
      return kiesFeit(rankFeiten(event, false), seed, g) ?? kiesUniek(DEGRADATIE, seed, g);
    }
    case "tier":
      return klimOfVal(
        event.richting === "promotie",
        event.playerId,
        roastSeed(event.playerId, event.at),
        ctx,
      );
    case "match": {
      const seed = roastSeed(event.match.id);
      const h = event.highlights;
      const teams = ctx.teams ?? {};
      const magRoasten = !verliezersHebbenSchild(event, ctx);
      // Nederlaag-feiten één keer afleiden (loser-perspectief), als de matchlijst
      // is meegegeven; anders blijft alles op de generieke pools.
      const vf = ctx.matches ? verliesFeiten(event.match, ctx.matches, teams, ctx.naamVoor) : null;

      // Bounty (#805) gaat vóór: dat de leider z'n prijs betaalde — of 'm nét
      // overeind hield — is het grootste verhaal van zo'n match. Draagt de
      // verliezer een schild, dan wordt het lof voor de winnaars in plaats van
      // spot met hem.
      if (h.some((x) => x.type === "bounty")) {
        if (!magRoasten) return coachLof(matchLofCtx(event, ctx), seed, g);
        return kiesUniek(BOUNTY_GECLAIMD, seed, g);
      }
      if (h.some((x) => x.type === "bounty-verdedigd")) {
        // De spot geldt de mislukte premiejagers, dus ook hier telt hun schild.
        if (!magRoasten) return coachLof(matchLofCtx(event, ctx), seed, g);
        return kiesUniek(BOUNTY_VERDEDIGD, seed, g);
      }

      if (h.some((x) => x.type === "lef")) {
        const feit = kiesFeit(lefFeiten(event, ctx), seed, g);
        if (feit) return feit;
      }

      // Winreeks en upset zijn prestaties: Coach Rudy juicht of prikt (#199). Het
      // schild van de gevierde speler tempert de hype tot mild; dat van de
      // verliezer sluit de jab helemaal uit, want die spot met hém.
      if (h.some((x) => x.type === "streak" || x.type === "duo")) {
        const lofCtx = matchLofCtx(event, ctx);
        if (hypeBeurt(lofCtx, seed)) return coachLof(lofCtx, seed, g);
        return kiesFeit(reeksFeiten(event, ctx), seed, g) ?? kiesUniek(REEKS, seed, g);
      }
      if (h.some((x) => x.type === "upset")) {
        const lofCtx = matchLofCtx(event, ctx);
        if (!magRoasten || hypeBeurt(lofCtx, seed)) return coachLof(lofCtx, seed, g);
        return kiesFeit(upsetFeiten(event, vf, magRoasten), seed, g) ?? kiesUniek(UPSET, seed, g);
      }
      if (h.some((x) => x.type === "score" && x.label === "bagel")) {
        if (magRoasten) {
          const feit = kiesFeit(bagelFeiten(vf), seed, g);
          if (feit) return feit;
        }
        return kiesUniek(magRoasten ? BAGEL : BAGEL_NEUTRAAL, seed, g);
      }
      if (h.some((x) => x.type === "score" && x.label === "monsterzege")) {
        if (magRoasten) {
          const feit = kiesFeit(monsterFeiten(vf), seed, g);
          if (feit) return feit;
        }
        return kiesUniek(MONSTER, seed, g);
      }
      return null; // gewone match: Coach Rudy zwijgt (anti-ruis)
    }
    default:
      return null;
  }
}

/**
 * De stemming/gezichtsuitdrukking die bij Coach Rudy's commentaar op dit event
 * hoort — bepaalt welke illustratie de feed-bubble toont. Loopt bewust gelijk
 * met de vertakkingen van coachOpmerking hierboven: persoonlijke sneren krijgen
 * de groepsintensiteit (mild/gemeen/radioactief), zeges en promoties maken hem
 * trots, en de rest valt terug op zijn neutrale portret.
 */
export function coachStemming(
  event: FeedEvent,
  intensiteitVoor: (groupId: string) => RoastIntensiteit,
): CoachMood {
  switch (event.kind) {
    case "maand-pias":
    case "pias-week":
    case "zwarte-piet":
      return intensiteitVoor(event.groupId);
    case "season-champion":
      return "trots";
    case "rank": {
      const omhoog =
        event.shift === "nieuw" ||
        (typeof event.shift === "number" && event.shift > 0);
      return omhoog ? "trots" : "gemeen";
    }
    case "tier":
      // Rudy buigt voor de nieuwe dictator (#531): promotie naar El Padelissimo
      // krijgt de knieval-mood; overige tier-events blijven neutraal (portret).
      return event.richting === "promotie" && event.naarLabel === "El Padelissimo"
        ? "buiging"
        : "portret";
    case "match": {
      const h = event.highlights;
      // Een geïnde bounty is leedvermaak, een verdedigde is een sneer naar de
      // jagers — allebei de gemene mood (#805).
      if (h.some((x) => x.type === "bounty" || x.type === "bounty-verdedigd"))
        return "gemeen";
      const lefH = h.find((x) => x.type === "lef");
      if (lefH && lefH.type === "lef") {
        return lefH.won ? "trots" : "gemeen";
      }
      if (h.some((x) => x.type === "streak" || x.type === "duo")) return "trots";
      if (h.some((x) => x.type === "upset")) return "trots";
      if (h.some((x) => x.type === "score" && x.label === "monsterzege")) return "trots";
      if (h.some((x) => x.type === "score" && x.label === "bagel")) return "gemeen";
      return "portret";
    }
    default:
      return "portret";
  }
}
