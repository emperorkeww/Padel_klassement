// Smoesjesmachine (#167): na een verloren match één tik → een willekeurig,
// ludiek excuus. Puur client-side, geen data — een vaste NL-lijst met een
// deterministische keuze op een seed, zodat dezelfde (match, worp) altijd
// hetzelfde smoesje geeft en "opnieuw" een nieuwe trekt.

/** De volledige smoezenpool. Zelfspottend en plagend — donker mag, echt
 *  beledigend of grof nooit. */
export const SMOESJES: string[] = [
  "Mijn overgripje was veel te glad, mijn racket gleed zo uit mijn hand.",
  "De glazen wanden waren vandaag abnormaal stroef, waardoor de bal totaal niet opveerde.",
  "Ik had gisteren legday, mijn benen voelden letterlijk aan als beton.",
  "Mijn partner stond constant in mijn weg te zwaaien.",
  "De ballen waren veel te zacht, alsof we met natte tennisballen speelden.",
  "De tegenstanders waren stiekem linkshandig, dat is tactisch gewoon niet eerlijk.",
  "Ik had mijn racket blijkbaar verkeerd vast bij die beslissende lobs.",
  "Het veld was vandaag echt abnormaal snel, de bal vloog alle kanten op.",
  "De schijnwerpers stonden zo fel afgesteld dat ik bij elke smash verblind werd.",
  "De tegenstanders speelden elk punt via het glas. Dat is toch geen echt padel!",
  "We hadden gewoon enorm veel pech met de netband vandaag.",
  "Ik had te veel koffie gedronken en trilde mijn racket zowat uit.",
  "Mijn schoenen hadden totaal geen grip op dit specifieke kunstgras.",
  "Het was veel te koud om fatsoenlijke spin aan de bal te geven.",
  "Mijn racket trilde veel te zwaar bij elke impact.",
  "Ik was simpelweg te sportief en sloeg elke bal recht op hun racket.",
  "Hun tactiek bestond volledig uit puur geluk en toevallige windvlagen.",
  "De wind blies al mijn perfecte effectballen de kooi uit.",
  "De tegenstanders bleven maar praten tussen de punten door. Psychologische oorlogsvoering!",
  "Ik zat met mijn hoofd al in het café.",
  "Mijn motivatie checkte na de eerste opslag al uit.",
  "Verloren, maar wel met stijl. Dat telt toch ook?",
  "Nederlagen bouwen karakter. Ik zit inmiddels bomvol karakter.",
  "Mijn beste slagen bewaar ik blijkbaar voor in mijn dromen.",
  "De trillingen van de snelweg hiernaast brachten me steeds uit mijn concentratie.",
  "Mijn tegenstander droeg een T-shirt in exact dezelfde kleur als de bal. Camouflage!",
  "De zwaartekracht leek aan hun kant van het net net iets minder hard te trekken.",
  "Ik had last van een acute vorm van padellelleboog vanaf de warming-up.",
  "Mijn horloge trilde steeds dat ik mijn stappendoel had bereikt, heel afleidend.",
  "Er lag te veel zand op de baan, ik gleed constant weg alsof we op het strand stonden.",
  "Mijn partner speelde met een te zacht racket, alle energie werd geabsorbeerd.",
  "De tegenstander maakte constant verdachte geluiden net voor ik wilde slaan.",
  "Ik ben gewend aan een indoorbaan, deze buitenlucht deed vreemde dingen met de bal.",
  "Het hekwerk veerde helemaal verkeerd terug, dat was statistisch onmogelijk.",
  "Er vloog precies een wesp langs mijn oor op het moment dat ik die vibora wilde slaan.",
  "Mijn racket is eigenlijk bedoeld voor gevorderden, ik ben simpelweg te bescheiden voor dit materiaal.",
  "De zon stond precies in een hoek van 37 graden, onspeelbaar.",
  "Mijn partner gaf me de hele tijd tactische tips die ik niet begreep.",
  "Ik had net mijn nagels geknipt en had totaal geen gevoel meer in mijn vingers.",
  "Mijn schoenveter zat net een millimeter te strak, dat verstoorde mijn hele balans.",
  "De scheidsrechter – die er niet was – had hier zeker in ons voordeel gefloten.",
  "Ik was mijn favoriete zweetbandje vergeten, het zweet prikte constant in mijn ogen.",
  "Het tempo lag gewoon veel te laag, ik raakte er helemaal uitgedroogd van.",
  "Mijn tegenstanders speelden met een racket met een veel grotere sweetspot, dat is materiaal-doping.",
  "Ik had vlak voor de wedstrijd een zware lunch op, mijn maag werkte als een anker.",
  "Hun lobs waren zo hoog dat ze een eigen postcode nodig hadden, dat is geen padel meer.",
  "Ik gleed uit over een verdwaald blaadje op de baan. Levensgevaarlijk.",
  "Mijn racket is nog niet goed ingespeeld, het moet nog even wennen aan mijn niveau.",
  "Mijn partner pakte alle ballen die voor mij bedoeld waren, en liet de rest lopen.",
  "De ballenjongens waren er niet om de druk van de ketel te halen.",
  "Ik probeerde een nieuwe spectaculaire slag uit die nog in de bètafase zit.",
  "Mijn bioritme zit vandaag in een diep dal, fysiek onmogelijk om te winnen.",
  "De tegenstander serveerde veel te snel, ik had nog niet eens mijn grip klaarliggen.",
  "Ik speel eigenlijk veel beter onder kunstlicht, dit felle daglicht onthulde al mijn zwakke plekken.",
  "De ruit van de kooi was zo schoon dat ik dacht dat de bal erdoorheen kon.",
  "Er hing een vreemde geur van versgebakken frietjes bij de kantine, ik kon alleen nog maar aan eten denken.",
  "De luchtvochtigheid was zo hoog dat mijn slagen halverwege het net al naar beneden stortten.",
  "De tegenstander speelde met een felgele broek, waardoor ik de bal telkens uit het oog verloor.",
  "Ik wilde de wedstrijd spannend houden voor het publiek, maar ben iets te ver doorgeschoten.",
  "Mijn gripwikkeling zat niet helemaal symmetrisch, dat nekte me bij elke forehand.",
  "De rastering van het hekwerk was zo slordig gelast dat elke stuit onvoorspelbaar werd.",
  "De tegenstanders bleven maar zuchten en steunen, dat is emotionele chantage.",
  "Mijn overgripje was te dik gewikkeld, ik voelde de bal helemaal niet meer.",
  "Er zat een kleine barst in mijn racket waar ik de hele tijd naar moest kijken.",
  "De lichten gingen precies aan toen ik op het punt stond om te smashen.",
  "Het zand was ongelijk verdeeld, op de ene plek gleed ik uit en op de andere stond ik direct stil.",
  "De tegenstander rook zo sterk naar goedkope aftershave dat ik er hoofdpijn van kreeg.",
  "Er vloog een pluisje van een paardenbloem voorbij dat ik aanzag voor de bal.",
  "Ik was afgeleid door een speler op de baan naast ons die een vliegende smash probeerde te doen.",
  "Mijn partner had een veel te luide ademhaling, ik dacht steeds dat er een trein achter me reed.",
  "De bal was nat geworden door een plasje water in de hoek van de baan.",
  "Mijn racketkoordje zat zo strak om mijn pols dat mijn hand bijna afstierf.",
  "De tegenstander maakte een vreemd huppeltje bij de service, dat was hypnotiserend.",
  "Ik had last van opwaaiend stof uit de omliggende bloemperken.",
  "De windvlaag kwam precies op het moment dat ik in de lucht hing voor een smash.",
  "Mijn schoenen zijn eigenlijk gemaakt voor gravel, dit kunstgras is veel te stroef.",
  "De tegenstander speelde met een racket dat dezelfde kleur had als de muur.",
  "Mijn partner riep steeds 'ik heb hem!' om vervolgens een meter mis te slaan.",
  "Ik dacht dat we nog een set moesten spelen, ik was mijn energie aan het doseren.",
  "De spanning op mijn racket snaren was door de temperatuur met 0.2 kilo gedaald.",
  "De ballen voelden zwaar aan door de hoge luchtvochtigheid in de hal.",
  "Er stond te veel druk op deze match, ik kan beter presteren onder lagere verwachtingen.",
  "De tegenstander serveerde steeds net op de lijn, dat is gewoon onsportief nauwkeurig.",
  "Mijn gripje was te koud geworden tijdens de warming-up.",
  "Mijn partner bleef maar vertellen over zijn geweldige slagen van vorige week.",
  "Er hing een lichte mist boven de baan die mijn dieptezicht verstoorde.",
  "Mijn racket trilde op een frequentie die precies mijn slagarm verlamde.",
  "De zon weerkaatste op de horloge van de tegenstander, puur opzet.",
  "Ik had gisteren te lang op de fiets gezeten, mijn knieën wilden niet meer buigen.",
  "De tegenstander raakte de netband drie keer achter elkaar. Dat is geen geluk meer, dat is magie.",
  "De kooi was veel te klein, ik had constant het gevoel dat ik tegen het glas zou vliegen.",
  "De ballen waren gloednieuw, die stuiteren veel te onvoorspelbaar vergeleken met oude ballen.",
  "De scheidsrechter – als die er was geweest – had die bal zeker uit gegeven.",
  "Mijn partner nam de leiding over, terwijl ik de geboren leider van dit team ben.",
  "Mijn favoriete sportdrankje was uitverkocht in de kantine.",
  "Ik gleed weg in een plas bier die de supporters daar hadden achtergelaten.",
  "De tegenstander speelde met een extreem langzame service om mijn ritme te breken.",
  "Er zat een vliegje aan de binnenkant van mijn sportbril.",
  "Ik had te veel focus op de techniek, waardoor ik vergat de bal daadwerkelijk te raken.",
  "Het was simpelweg de schuld van de zinsbouw van deze nederlaag.",
];

/**
 * Kleine deterministische hash van een string (djb2-variant), zodat een
 * match-id in een stabiele seed omgezet kan worden zonder dependency.
 */
export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/** Kiest deterministisch één smoesje uit de pool op basis van `seed`. */
export function kiesSmoes(seed: number): string {
  const i = ((seed % SMOESJES.length) + SMOESJES.length) % SMOESJES.length;
  return SMOESJES[i];
}

// ── Rudy's Goedkeuring (#296) ────────────────────────────────────────────────
// Coach Rudy neemt de rol van juryvoorzitter: elk smoesje krijgt een oordeel of
// het "professioneel genoeg" is. Drie gradaties, elk met een eigen pool. Het
// oordeel is deterministisch geseed op het smoesje zélf (niet op de worp), zodat
// hetzelfde smoesje altijd hetzelfde oordeel geeft — reproduceerbaar en deelbaar.

export type OordeelGradatie = "afgekeurd" | "matig" | "goedgekeurd";

/** De drie jury-pools. Elke regel bevat zijn eigen ❌/⚠️/✅-teken. */
export const OORDEEL: Record<OordeelGradatie, readonly string[]> = {
  afgekeurd: [
    "❌ Te zwak. Zeg liever dat je gripje in de boter was gevallen.",
    "❌ Afgekeurd. Dit overtuigt zelfs de meest naïeve supporter op de tribune niet.",
    "❌ Amateuristisch. Zo'n excuus gaf ik nog niet eens na een kansloze uitschakeling in de groepsfase.",
    "❌ Nee. Kom terug als je er echt over hebt nagedacht, net als bij een tactische wissel.",
    "❌ Te doorzichtig. Ik prik hier sneller doorheen dan een spits door een slap verdedigingsblok.",
    "❌ Dit is geen excuus, dit is een wanprestatie in communicatie. Terug naar de tekentafel.",
    "❌ Hier trapt zelfs de videoscheidsrechter (VAR) met zijn ogen dicht nog niet in.",
    "❌ Slap. Dit niveau excuses hoort thuis in de kelderklasse, niet op dit niveau.",
    "❌ Zelfs met een penalty mee kom je hier niet mee weg. Waardeloos geformuleerd.",
    "❌ Dit excuus mist elke vorm van grinta. Hup, opnieuw proberen!",
    "❌ Ongeloofwaardig. Als dit je tactiek was om de schuld af te schuiven, ben je hopeloos mislukt.",
    "❌ Hier kan ik werkelijk niets mee. Zelfs een degradatiekandidaat verzint betere uitvluchten.",
    "❌ Waardeloos. Zelfs met een zaklamp vind ik de logica in dit excuus niet.",
    "❌ Dit is geen smoes, dit is een capitulatie. Ik eis meer creativiteit langs de lijn.",
    "❌ Onvoldoende. De bondscoach zou hier direct een onderzoek naar starten wegens matchfixing van de waarheid.",
    "❌ Zelfs de supportersvereniging van de tegenpartij gelooft dit slappe verhaal niet.",
    "❌ Een tactische blunder van jewelste. Dit excuus mist elke vorm van diepgang.",
    "❌ Gezakt. Mijn legendarische notitieboekje sluit zich met een luide klap voor dit drama.",
    "❌ Als dit je verdediging is, raad ik je aan om snel een advocaat te zoeken.",
    "❌ Kansloos. Dit excuus heeft de houdbaarheid van een geopende fles champagne.",
  ],
  matig: [
    "⚠️ Matig. Dit excuus gebruikte ik al in 2024 tegen Frankrijk. Iedereen prikte erdoorheen.",
    "⚠️ Kan ermee door, maar het mist overtuiging. Net als onze veldbezetting in de tweede helft.",
    "⚠️ Redelijk. Geen tactisch hoogstandje, maar hiermee voorkom je in ieder geval een totale afgang.",
    "⚠️ Twijfelgeval. Ik noteer hem met potlood in mijn beruchte notitieboekje.",
    "⚠️ Het houdt net stand. Maar bij de eerste kritische vraag van de pers stort het alsnog in.",
    "⚠️ Een krappe voldoende. Je krijgt het voordeel van de twijfel, maar de fans morren.",
    "⚠️ Niet slecht, maar de analytici in de studio gaan dit genadeloos fileren.",
    "⚠️ Acceptabel, maar de vonk ontbreekt. Alsof je op safe speelt voor een bloedeloze 0-0.",
    "⚠️ Dit excuus schuurt tegen de grens aan. Eén kritische blik en je valt door de mand.",
    "⚠️ Je overleeft de persconferentie hiermee, maar reken op een onvoldoende in de krant morgen.",
    "⚠️ Wel aardig geprobeerd, maar de scheidsrechter fluit je hiermee direct terug.",
    "⚠️ Er zit een kern van waarheid in, maar het mist de flair om echt indruk te maken.",
    "⚠️ Dit is een twijfelgevalletje. De VAR zou hier minutenlang naar moeten kijken.",
    "⚠️ Een mager zesje. Je overleeft de groepsfase hiermee, maar in de knock-outfase lig je eruit.",
    "⚠️ Niet slecht geprobeerd, maar de tactische analisten op tv lachen je hiermee uit.",
    "⚠️ Dit excuus mist een duidelijke lijn. Het zwabbert alle kanten op, net als je backhand.",
    "⚠️ Matig. Alsof je met 10 man achterin gaat hangen en hoopt op een counter.",
    "⚠️ Een grijs excuus. Bruikbaar bij gebrek aan beter, maar niemand gaat hiervoor applaudisseren.",
    "⚠️ Dit lost de crisis niet op, het stelt de onvermijdelijke kritiek hooguit een weekje uit.",
    "⚠️ Het is dat ik een goede bui heb, anders had ik dit excuus direct naar de prullenbak verwezen.",
  ],
  goedgekeurd: [
    "✅ Goedgekeurd! Deze ga ik zelf ook gebruiken bij de volgende persconferentie.",
    "✅ Uitstekend. Zo verkoop je een nederlaag als een tactisch meesterplan.",
    "✅ Sterk staaltje smoeswerk. Hier kan de vaderlandse sportpers nog wat van leren.",
    "✅ Klasse. Dit excuus verdient een permanente plek in mijn gouden notitieboekje.",
    "✅ Perfect. Geen speld tussen te krijgen, zelfs niet voor een kritische analist.",
    "✅ Briljant! Dit leidt de aandacht volledig af van je eigenlijke vormcrisis.",
    "✅ Wereldklasse. Dit is hoe een echte professional de schuld extern legt.",
    "✅ Magistraal verwoord. De tegenstander gelooft nu waarschijnlijk zelf ook dat het aan de wind lag.",
    "✅ Dit is pure poëzie onder de excuses. Een tactisch meesterwerk.",
    "✅ Goedgekeurd. Met deze verklaring behoud je de regie over het narratief.",
    "✅ Absoluut fantastisch. Zelfs de meest kritische journalist krijgt hier de mond mee gesnoerd.",
    "✅ Geniaal bedacht. Hiermee verander je een nederlaag in een morele overwinning.",
    "✅ Briljant! Hiermee leg je de schuld volledig bij de kosmos. Geen speld tussen te krijgen.",
    "✅ Uitstekend. Dit excuus is zo goed dat we direct een standbeeld voor je moeten oprichten.",
    "✅ Subliem. Zelfs de bondscoach van de tegenstander knikt instemmend na deze verklaring.",
    "✅ Klasse. Hiermee speel je jezelf direct in de kijker bij de grote clubs.",
    "✅ IJzersterk. Dit excuus staat als een tactisch perfect georganiseerde verdediging.",
    "✅ Meesterlijk! De pers is zó onder de indruk dat ze vergeten te vragen naar de uitslag.",
    "✅ Dit excuus verdient een gouden lijstje en een ereplaats in het clubhuis.",
    "✅ Absoluut topniveau. Dit is de Champions League van de excuses.",
  ],
} as const;

/** Neutrale variant bij roast-schild: geen jury-oordeel, enkel een nuchtere
 *  notering. Plagen, geen kwetsen — wie niet mee wil, hoeft niet. */
export const OORDEEL_NEUTRAAL: readonly string[] = [
  "Genoteerd. Volgende keer beter.",
  "Ook een reden is een reden. Doorgaan.",
  "Genoteerd zonder commentaar.",
  "Excuus ontvangen en opgeslagen.",
  "We nemen het mee in de evaluatie.",
  "Duidelijk. De focus kan weer op de volgende wedstrijd.",
  "Verklaring geregistreerd in het systeem.",
  "Begrepen. Kop omhoog en weer door.",
] as const;

export interface Oordeel {
  gradatie: OordeelGradatie;
  tekst: string;
}

const GRADATIES: readonly OordeelGradatie[] = ["afgekeurd", "matig", "goedgekeurd"];

/**
 * Coach Rudy's jurybeoordeling van een smoesje. Deterministisch geseed op de
 * smoesje-tekst zelf: hetzelfde smoesje → hetzelfde oordeel. Gradatie en de
 * regel binnen die gradatie krijgen aparte seeds, zodat ze niet gecorreleerd
 * zijn. Bij `schild` een neutrale, ongekleurde notering (geen ❌/⚠️/✅).
 */
export function kiesOordeel(smoes: string, schild = false): Oordeel {
  if (schild) {
    const i = hashPrefixed("oordeel-neutraal", smoes, OORDEEL_NEUTRAAL.length);
    return { gradatie: "matig", tekst: OORDEEL_NEUTRAAL[i] };
  }
  const gradatie = GRADATIES[hashPrefixed("oordeel-graad", smoes, GRADATIES.length)];
  const pool = OORDEEL[gradatie];
  const tekst = pool[hashPrefixed("oordeel-tekst", smoes, pool.length)];
  return { gradatie, tekst };
}

/** Positieve index in `[0, len)` uit een geprefixte hash van `smoes`. Het
 *  prefix ontkoppelt de verschillende keuzes (gradatie vs. regel) van elkaar. */
function hashPrefixed(prefix: string, smoes: string, len: number): number {
  const h = hashString(`${prefix}|${smoes}`);
  return ((h % len) + len) % len;
}
