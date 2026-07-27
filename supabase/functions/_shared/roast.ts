// Gedeelde roast-bouwstenen voor de Edge Functions. Edge functions delen geen
// code met src/, dus dit is een eigen compacte set die de toon-conventies van
// src/features/coach/ spiegelt (plagend over padel en ego, nooit persoonlijk of
// grof). Sinds #409 staan hier twee tekstsets: de pias-sneer (#203) en de
// afdroging-teksten (bagel/monsterzege), plus de gedeelde seed-helpers.

export type RoastIntensiteit = "mild" | "gemeen" | "radioactief";

// Stabiele djb2-hash + deterministische keuze, gekopieerd uit
// src/features/coach/roastTone.ts (roastSeed/seedIndex) zodat een
// webhook-retry dezelfde tekst oplevert.
export function roastSeed(...delen: string[]): number {
  let h = 5381;
  const s = delen.join("|");
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function kiesUit(pool: readonly string[], seed: number): string {
  return pool[((seed % pool.length) + pool.length) % pool.length];
}

/** Puntenverschil vanaf wanneer een winst een "monsterzege" is — gelijk aan
 *  MONSTERZEGE_DREMPEL in src/features/profiles/badges.constants.ts (#409), zodat
 *  push en feed dezelfde afdroging "monsterzege" noemen. */
export const MONSTERZEGE_DREMPEL = 4;

/** De afdroging-soort van een uitslag, of null bij een gewone score. Spiegelt
 *  scoreHighlight() in src/features/feed/feedLogic.ts: bagel (6-0) is het
 *  sterkste verhaal, dan monsterzege (verschil ≥ MONSTERZEGE_DREMPEL). */
export function afdrogingLabel(
  m: { score_a: number | null; score_b: number | null },
): "bagel" | "monsterzege" | null {
  if (m.score_a == null || m.score_b == null) return null;
  const hi = Math.max(m.score_a, m.score_b);
  const lo = Math.min(m.score_a, m.score_b);
  if (lo === 0 && hi > 0) return "bagel";
  if (hi - lo >= MONSTERZEGE_DREMPEL) return "monsterzege";
  return null;
}

// Pias-sneren voor de push (#203), bewust kort genoeg voor een notificatie.
export const PIAS_SNEER: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Grote favoriet, klein resultaat. Gebeurt de besten. Jou net iets vaker.",
    "De statistieken geloofden in je. De bal duidelijk niet.",
    "Iedereen mag eens verliezen. Alleen deed jij het als torenhoge favoriet.",
    "Kop op: volgende week is er een nieuwe pias. Al ben jij nu wel favoriet.",
    "Je was dé favoriet. Wás. Verleden tijd, net als je vormpeil.",
    "Padel is een teamsport, maar deze titel heb je helemaal zelf verdiend.",
  
    "Van favoriet naar pias. De statistieken huilen met me mee.",
    "Grote verwachtingen, mager resultaat. Dat is de samenvatting van jouw match.",
    "Torenhoge favoriet vooraf, maar op de baan was het vooral twijfel troef.",
    "Je rating voorspelde winst. Je voetenwerk besloot anders.",
    "De pias-titel staat je goed. Nu alleen nog een beetje gaan trainen.",
    "Als favoriet onderuit gaan: een zeldzaamheid, al gebeurt het jou best vaak.",
    "Winst was begroot, verlies is geleverd. Welkom in de realiteit.",
    "Je tegenstander lacht nog steeds. Gratis ratingpunten voor iedereen.",
    "Tactisch gezien was het vooral heel speciaal geprobeerd.",
    "De bookmakers hadden het mis, en jij helaas ook.",
],
  gemeen: [
    "De favoriet van de week werd de pias van de week. Poëzie, eigenlijk.",
    "Jij had de hoogste rating op de baan. De baan had daar geen boodschap aan.",
    "Winnen was het minimum. Jij ging vol voor het maximum aan schaamte.",
    "De underdogs danken je hartelijk. Hun hele week is goedgemaakt.",
    "Ik heb je winkans nagerekend. De wiskunde klopte, jij niet.",
    "Zelfs de glazen wand speelde beter mee dan jij.",
  
    "De favoriet werd de pias. Ik noteer deze historische choke met plezier.",
    "Zelfs de glazen wand had vandaag een actiever tactisch plan dan jij.",
    "Je rating was fantastisch, je bandeja leek op een slap stuk pannenkoek.",
    "Winnen was het minimum. Verliezen als favoriet is een regelrechte schande.",
    "De underdogs danken je hartelijk voor deze ongekende blunder.",
    "Ik heb je winkans nagerekend. De wiskunde was correct, jouw backhand niet.",
    "Zelfs mijn meest onbegrijpelijke wissels op het WK waren logischer dan jouw spel.",
    "Je partner verdient na dit debacle een fikse schadevergoeding.",
    "Met deze startsnelheid had je bij Napoli nog niet eens de hesjes mogen wassen.",
    "Een wanprestatie om in te lijsten. Liefst achter gesloten deuren.",
],
  radioactief: [
    "Dit zet ik in de groepschat. Voor de eeuwigheid.",
    "Zo'n winkans verprutsen hoort in een museum. Vitrine, spotje erop.",
    "De bookmakers zijn failliet aan jou. Je team ook, mentaal.",
    "Choke van de week? Choke van het seizoen, als je het mij vraagt.",
    "Je rating schreef een cheque die je armen niet konden innen.",
    "Ik heb het teruggekeken. Twee keer. Het werd niet beter.",
  
    "Dit zet ik in de groepschat. Voor de eeuwigheid en met hoofdletters.",
    "Zo'n gigantische winkans verprutsen hoort thuis in de hall of shame.",
    "De bookmakers liggen onder de tafel van het lachen. Je team huilt.",
    "Choke van de week? Choke van de eeuw, als je het mij vraagt.",
    "Je rating schreef een cheque die je armen vandaag absoluut niet konden innen.",
    "Ik heb het teruggekeken. Twee keer. Het deed elke keer evenveel pijn.",
    "Zelfs met Gianni Infantino aan de lijn is deze blunder niet recht te praten.",
    "We gaan je profiel tijdelijk deactiveren om verdere reputatieschade te voorkomen.",
    "Dit was geen wedstrijd, dit was een openbare executie van je eigen rating.",
    "Je sloeg die bal zo ver out dat we NASA moesten waarschuwen.",
],
};

// Sneer voor een verliezer van een droge 6-0 (#409). Zelfdragend: de tekst
// benoemt de bagel zelf, zoals de BAGEL-pool in coachFeed.ts.
export const BAGEL_SNEER: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Een droge 6-0. Gebeurt de besten — vandaag toevallig jou.",
    "Nul games. Kop op, morgen staat er weer een baan klaar.",
    "6-0 tegen. De cijfers zijn hard; jij was het even niet.",
    "Broodje bal geserveerd gekregen. Volgende keer beter.",
  
    "Nul games gepakt. Kop op, morgen staat er weer een baan klaar.",
    "6-0 tegen. De cijfers zijn genadeloos, je was er even niet bij.",
    "Broodje bagel geserveerd gekregen. Volgende keer de rackets vasthouden.",
    "Geen enkele game op het bord. Hopelijk was het opwarmertje tenminste leuk.",
    "6-0 verlies. Zelfs m'n sportpet zakte spontaan een stukje naar beneden.",
    "Nul op de teller. Snel vergeten voordat de pers er lucht van krijgt.",
    "Een droge bagel. Niet echt de maaltijd waar we op hadden gehoopt.",
    "6-0 nederlaag. We bouwen de basisslagen vanaf nul weer op.",
    "Met 6-0 weggespeeld. Volgende keer graag met iets meer inzet.",
],
  gemeen: [
    "Een droge 6-0. Hebben jullie de rackets eigenlijk uit de tas gehaald?",
    "Nul games. Zelfs het scorebord keek beschaamd de andere kant op.",
    "6-0. Dat is geen wedstrijd, dat is een openbare terechtstelling.",
    "Fietsbandjes uitgedeeld gekregen. Tijd voor stevige zelfreflectie.",
  
    "Een droge 6-0. Hebben jullie de rackets überhaupt wel uit de tas gehaald?",
    "Fietsbandjes uitgedeeld gekregen. Tijd voor een stevige en diepe zelfreflectie.",
    "Met 6-0 ingemaakt. Zelfs m'n spiekbriefjes bij Lille boden hier geen redding.",
    "Een droge 6-0. Je partner liep erbij als een mantelzorger op sportschoenen.",
    "Nul games gepakt. Ik heb slakken sneller zien reageren op een diepe lob.",
    "6-0 verlies. Dit tactische debacle schrijf ik met rode stift in m'n boekje.",
    "Geen game gewonnen. De tegenstander bedankte me voor de makkelijke training.",
    "Met 6-0 afgedroogd. Zelfs de watersproeiers sproeiden vandaag met medelijden.",
],
  radioactief: [
    "Een droge 6-0. Dit zet ik in de groepschat. Voor de eeuwigheid.",
    "Nul games. Ik heb 'm teruggekeken. Twee keer. Het werd niet beter.",
    "6-0. De glazen wanden trillen nog na van deze vernedering.",
    "Zo'n afgang hoort in een museum. Vitrine, spotje erop.",
  
    "6-0. De glazen wanden trillen nog na van deze ongekende vernedering.",
    "Zo'n afgang hoort in een museum. Vitrine, spotje erop en entree heffen.",
    "0-6 verlies. We eisen dat dit resultaat direct uit de database wordt gewist.",
    "Een droge 6-0. Zelfs Aurelio De Laurentiis had je na dit optreden direct verbannen.",
    "Nul games. Ik overweeg serieus m'n coachlicentie in de Noordzee te gooien.",
    "6-0 tegen. Dit deed zo ontiegelijk veel pijn dat ik m'n sportpet wil verbranden.",
    "Bagel geïncasseerd. Zelfs de spinnen in de kelder kropen weg uit pure schaamte.",
    "0-6 afgedroogd. We gaan Infantino bellen om deze match uit de boeken te schrappen.",
],
};

// Sneer voor een verliezer van een monsterzege (verschil ≥ drempel, geen 6-0).
export const MONSTER_SNEER: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Meedogenloos afgemaakt. Baal even, en dan door.",
    "Flink pak slaag gehad. Volgende keer bijt je terug.",
    "Compleet overklast vandaag. Gebeurt de besten.",
    "Dat was geen partij, dat was een statement. Van de overkant.",
  
    "Meedogenloos afgemaakt. Baal even goed, en ga dan weer trainen.",
    "Flink pak slaag gehad vandaag. Volgende keer de tanden laten zien.",
    "Compleet overklast op de baan. Gebeurt de besten weleens.",
    "Dat was geen partij, dat was een statement. Van de overkant helaas.",
    "Flinke marge verlies. We gaan de beelden vanavond rustig analyseren.",
    "De tegenstander was een maatje te groot. Werk aan de winkel.",
    "Nederlaag met grote cijfers. Kop op, de competitie is nog lang.",
    "Flink pak slaag. Zorg dat de grip de volgende keer wél stroef is.",
    "Met ruime cijfers verloren. De basistechniek liet het vandaag afweten.",
    "Ruime nederlaag. Snel douchen en focus op de volgende match.",
],
  gemeen: [
    "Weggespeeld zonder pardon. Ze wisten niet eens waar je stond.",
    "Een pak slaag om in te lijsten. Voor hén, niet voor jou.",
    "Genadeloos ingemaakt. De coach knikt goedkeurend — naar de overkant.",
    "Vleesmolen-padel. Geen spaan heel gelaten van jullie.",
  
    "Een pak slaag om in te lijsten. Voor hen welteverstaan, niet voor jou.",
    "Vleesmolen-padel. Geen spaan heel gelaten van jullie vandaag.",
    "Flinke pandoering gehad. Zelfs de kantinebaas keek beschaamd weg.",
    "Weggespeeld. De tegenstander hoefde niet eens te rennen voor hun punten.",
    "Een afdroging van jewelste. Ik noteer 'm met een hele diepe zucht.",
    "Compleet onderuit gegaan. We wensen je partner veel sterkte toe.",
    "Afgestraft op alle fronten. Mijn tactische bord ligt in scherven.",
    "Ruim verloren. De tegenstander bedankte je voor de gratis ratingpunten.",
],
  radioactief: [
    "Een slachting. Ik noteer 'm met sadistisch genoegen.",
    "Dat was geen wedstrijd, dat was een openbare executie.",
    "Volledig van de baan geveegd. Dit niveau van overmacht is bijna wreed.",
    "Afgedroogd tot op het bot. Dit bespreken we nog jaren na.",
  
    "Een slachting. Ik noteer 'm met sadistisch genoegen in m'n boekje.",
    "Dat was geen wedstrijd, dat was een openbare executie op veld 1.",
    "Afgedroogd tot op het bot. Dit bespreken we nog jaren na in de kantine.",
    "Monsterlijke nederlaag. Ik heb m'n spiekbriefjes spontaan verbrand.",
    "Volledig gedeclasseerd. Zelfs de ballenjongens begonnen tactisch advies te roepen.",
    "Een afstraffing van historisch niveau. De persconferentie wordt een ramp.",
    "Gedecimeerd in de kooi. We overweegen een viervoudige wissel in te voeren.",
    "Afgedroogd. Zelfs Trump zou deze nederlaag niet meer kunnen spinnen als winst.",
    "Een slachting. De marine is al onderweg om je Elo uit de afgrond te bergen.",
],
};

// Schouderklopje voor de winnaars van een afdroging (#409). Geen persoonlijke
// sneer maar commentaar op de zege, dus niet intensiteit-geschaald en niet door
// het roast-schild beperkt — net als de hype-pools in coachFeed.ts.
export const AFDROGING_LOF: readonly string[] = [
  "Meedogenloos afgemaakt. Prachtig wreed — zo hoort dat.",
  "Geen spaan heel gelaten. De coach knikt goedkeurend.",
  "Dat was geen partij, dat was een statement. Chapeau.",
  "Weggespeeld zonder pardon. Dominantie met hoofdletters.",
  "Een pak slaag om in te lijsten. Genieten was het.",
  "De sloophamer erin. Effectief en genadeloos. Mooi.",
  "Absolute klasse. De tegenstander mocht enkel toekijken.",
  "Zo domineer je een baan. M'n notitieboekje krijgt een gouden randje.",
    "Meedogenloos afgemaakt. Prachtig wreed — zo hoort dat op baan 1.",
    "Geen spaan heel gelaten. De coach knikt uiterst goedkeurend.",
    "Dat was geen partij, dat was een statement. Chapeau voor de tactiek.",
    "Weggespeeld zonder pardon. Dominantie met hele grote letters.",
    "Een pak slaag om in te lijsten. Genieten langs de lijn.",
    "De sloophamer erin. Effectief, genadeloos en tactisch perfect.",
    "Absolute klasse. De tegenstander mocht enkel toekijken en zwaaien.",
    "Complete vernietiging. Dit was padel zoals ik het bedoeld heb.",
    "De tegenstander is volledig gedecimeerd. Een masterclass in omschakeling.",
];

// ── Anticipatie-pushes in Rudy's stem (#302) ────────────────────────────────
// Nieuwe-ronde en "jouw beurt" zijn géén straf maar een vooruitblik: schild aan
// (of onbekend profiel) → een warme, neutrale regel, anders een op intensiteit
// geschaalde plaag. Bewust notificatie-kort, zoals de PIAS/BAGEL-pools.

// Nieuwe ronde gegenereerd — de match staat klaar (send-push, new_round).
export const NIEUWE_MATCH_NEUTRAAL: readonly string[] = [
  "Er staat een nieuwe match voor je klaar. Veel plezier op de baan.",
  "Nieuwe ronde gegenereerd — kijk maar eens tegen wie je speelt.",
  "Je volgende match staat ingepland. Succes ermee.",
    "De competitie gaat door. Bekijk je nieuwe tegenstander op het schema.",
    "Nieuwe speelronde gepland. Tijd om de kooi in te gaan.",
    "Je volgende ontmoeting staat klaar. Veel succes gewenst.",
    "Ronde bijgewerkt. Controleer de opstelling en speeldatum.",
    "Match ingepland in het systeem. Succes op de baan.",
    "Een nieuwe uitdager wacht. Bereid je voor op de match.",
    "Het speelschema is vernieuwd. Bekijk je volgende duel.",
];
export const NIEUWE_MATCH: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Nieuwe ronde. Warm die smoesjes alvast op.",
    "Er staat een match klaar. Probeer deze keer wél te winnen.",
    "Je volgende tegenstander is bekend. Slaap er maar een nachtje minder om.",
    "Nieuwe match gegenereerd. Mijn notitieboekje ligt weer open.",
  
    "Nieuwe ronde. Warm die smoesjes alvast maar op.",
    "Nieuwe ronde. Zorg dat je racket deze keer wél ballen raakt.",
    "Je volgende partij staat klaar. De tactiek bespreken we later.",
    "Nieuwe match ingepland. Geen excuses meer over de wind vandaag.",
    "Er wacht een tegenstander. Tijd om te laten zien dat je getraind hebt.",
    "Nieuwe speelronde. Kop op, er zijn nog genoeg potjes om te winnen.",
    "Match gegenereerd. M'n sportpet staat alvast in de actiestand.",
],
  gemeen: [
    "Nieuwe ronde. Je tegenstander slaapt nog — verrassingsaanval?",
    "Er staat een match klaar. Ik heb de EHBO alvast stand-by gezet.",
    "Nieuwe match. Deze keer graag de bal wél over het net, als experiment.",
    "Je volgende partij is ingepland. Mijn tactische plan: hoop op geluk.",
  
    "Nieuwe ronde. Je tegenstander slaapt nog — tijd voor een verrassingsaanval?",
    "Nieuwe ronde. De tegenstander bedankte me alvast voor de makkelijke loting.",
    "Er wacht een duel. Ik heb m'n spiekbriefjes bij Lille alvast klaargelegd.",
    "Nieuwe match. Probeer je partner deze keer niet al te veel in de weg te lopen.",
    "Je volgende tegenstander staat klaar. M'n boekje ligt open voor de blunders.",
    "Nieuwe ronde. Een uitstekende kans om je rating verder te verruineren.",
    "Er staat een match gepland. Probeer in ieder geval de kooiwand te vermijden.",
],
  radioactief: [
    "Nieuwe ronde. Verlies deze en ik lees het voor op de persconferentie.",
    "Er staat een match klaar. Begin vast met een creatief excuus verzinnen.",
    "Nieuwe match. Ik heb m'n rode pen al geslepen voor het notitieboekje.",
    "Je volgende tegenstander is bekend. Zij ook — en zij lachen.",
  
    "Je volgende tegenstander is bekend. Zij ook — en zij lachen nu al.",
    "Nieuwe ronde. Zelfs Infantino kan je niet redden als je deze verliest.",
    "Er wacht een match. Verlies dit niet, anders mag je de banen gaan vegen.",
    "Nieuwe match gegenereerd. We gaan de VAR alvast waarschuwen voor jouw slagen.",
    "Je volgende duel staat gepland. Mijn advies? Begin vast met excuses schrijven.",
    "Nieuwe ronde. Tijd om te kijken of je Elo nog dieper kan zinken.",
    "Er staat een match klaar. Een Trumpiaans debacle dreigt bij verlies.",
],
};

// "Jouw beurt": vlak vóór een geplande match (match-reminders). De regels volgen
// op "Om <tijd> sta je op de baan.", dus ze staan op zichzelf zonder tijd.
export const JOUW_BEURT_NEUTRAAL: readonly string[] = [
  "Succes met je match!",
  "Zet 'm op vandaag.",
  "Veel plezier op de baan.",
    "Focus op je eigen spel vandaag.",
    "Laat de ballen maar vliegen, succes.",
    "Matchday! Ga ervoor op de baan.",
    "Tijd voor padel. Zet 'm op.",
    "Veel succes in de kooi vandaag.",
    "Laat zien wat je kunt, veel plezier.",
    "Match staat gepland. Veel succes.",
];
export const JOUW_BEURT: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Vergeet je racket niet, en je smoesjes ook niet.",
    "Warmloopschoenen aan — het is bijna tijd.",
    "Tijd om te laten zien dat je getraind hebt. Toch?",
    "Nog even en de bal rolt. Focus.",
  
    "Bijna tijd voor de kooi. Geen gejank over de wind vandaag.",
    "Racket in de hand en gaan. Succes ermee.",
    "Matchdag! Probeer de basisslagen simpel te houden.",
    "De tegenstander wacht. Warm die spieren snel op.",
    "Nog een paar minuten voor de start. Focus op het net.",
    "Tijd om de baan op te stappen. Laat m'n boekje met rust vandaag.",
],
  gemeen: [
    "Probeer deze keer op te komen dagen én te scoren.",
    "Ik hou m'n notitieboekje bij de hand. Voor de zekerheid.",
    "Je tegenstander is al aan het rekken. Jij nog aan het twijfelen?",
    "Tijd om te bewijzen dat het geen typefout in het klassement was.",
  
    "Ik hou m'n notitieboekje bij de hand. Voor de zekerheid en de stats.",
    "Probeer de bal deze keer wél binnen de kooi te houden.",
    "Jouw beurt. Ik heb m'n spiekbriefjes al paraat voor de blunders.",
    "Tijd om de baan op te gaan. Hopelijk loop je je partner niet voor de voeten.",
    "Match begint zo. Laat zien dat je startmotor sneller is dan een slak.",
    "Jouw beurt. Geen alibi's meer zodra de eerste service landt.",
    "De kooi wacht. Probeer in ieder geval de ramen van de buren heel te laten.",
],
  radioactief: [
    "Verlies je deze, dan hoort de hele groepschat het van me.",
    "Laatste kans om m'n tactische plan niet volledig te verpesten.",
    "De persconferentie na afloop schrijf ik nu al. Kies zelf de toon.",
    "Kom opdagen. Of niet — dan win ik de weddenschap met mezelf.",
  
    "Verlies je deze, dan hoort de hele groepschat het direct van me.",
    "Jouw beurt. We gaan Infantino bellen als de VAR weer moet ingrijpen.",
    "De kooi roept. Verlies dit niet, anders verscheur ik je spelerspas.",
    "Tijd om te spelen. M'n rode pen ligt al klaar voor je rating-degradatie.",
    "Jouw beurt. Probeer in ieder geval te doen alsof je de regels kent.",
    "De match begint. Bereid je voor op een tactische masterclass of afgang.",
    "Tijd voor de waarheid. Zelfs Trump kan een nederlaag vandaag niet spinnen.",
],
};

// Relationele/planning-pushes (#302): een vriendschapsverzoek en de speeldag-
// polls zijn niet-kwetsend en gaan vaak naar meerdere ontvangers, dus één warme,
// licht plagende pool — schild-neutraal per definitie, niet intensiteit-geschaald
// (zoals AFDROGING_LOF). Ze volgen op een informatieve eerste zin.
export const VRIENDSCHAP: readonly string[] = [
  "Vers bloed voor je vijandenlijst. Ik noteer 'm.",
  "Een nieuwe rivaal in de maak. Accepteer maar, dan kun je verliezen.",
  "Nog een naam om straks van te winnen. Of andersom.",
  "Tijd om die vriendschap op de baan te testen.",
  "Ik verheug me nu al op jullie eerste onderlinge bloedbad.",
    "Tijd om die vriendschap op de baan grondig te testen.",
    "Een nieuwe vriend op papier, een nieuwe prooi in de kooi.",
    "Vriendschapsverzoek binnen. Tijd om te kijken wie tactisch sterker is.",
    "Nieuwe rivaal toegevoegd. M'n notitieboekje heeft weer een extra regel.",
    "Verzoek geaccepteerd. De kooi ligt klaar voor jullie eerste duel.",
    "Nieuwe naam in de lijst. Vandaag vrienden, morgen concurrenten.",
];
export const POLL_NIEUW: readonly string[] = [
  "Stem wanneer je kunt — mijn wisselschema hangt ervan af.",
  "Laat weten wanneer je kan, dan plan ik de vernedering in.",
  "Geef je momenten door voordat de groep zonder jou beslist.",
  "Stemmen is verplicht. Nou ja, sterk aangeraden.",
    "Stemmen is verplicht. Nou ja, sterk aangeraden door de coach.",
    "Nieuwe poll live. Vul je datums in voordat ik de opstelling maak.",
    "Geef je beschikbaarheid door. Geen smoesjes achteraf over te drukke agenda's.",
    "Tijd om te stemmen. De banen boeken zichzelf niet.",
    "Laat horen wanneer je kunt spelen. De kooi wacht op ons.",
    "Nieuwe speelpoll. Vul snel in, de persconferentie wacht niet.",
    "Beschikbaarheid gevraagd. Zorg dat je erbij bent deze ronde.",
];
export const POLL_MOMENT: readonly string[] = [
  "Zet 'm in je agenda, geen smoesjes achteraf.",
  "Kom opdagen, of leg het straks maar uit aan mij.",
  "De baan roept. Jij hopelijk ook.",
    "Kom opdagen, of leg het straks maar uit aan mij langs de lijn.",
    "De baan roept. Jij hopelijk ook met een positieve reactie.",
    "Speelmoment gekozen. Rackets oppoetsen en sportschoenen vastmaken.",
    "Datum staat vast. Zorg dat je fit aan de start verschijnt.",
    "Het moment is bepaald. Geen alibi's meer over de wind of regen.",
    "Ingepland. Ik verwacht tactische discipline vanaf de eerste minuut.",
    "Speeltijd genoteerd. M'n spiekbriefjes liggen al klaar in m'n zak.",
    "De kooi is gereserveerd. Tijd om te laten zien wat je waard bent.",
    "Matchtijd bevestigd. Geen excuses, gewoon spelen en winnen.",
];
export const POLL_GEBOEKT: readonly string[] = [
  "Baan geboekt. Nu jij nog, in vorm.",
  "Het is officieel. Poets die rackets op.",
  "Geregeld. Ik verwacht een waardig schouwspel.",
    "Baan geboekt. Nu jij nog, bij voorkeur in vorm.",
    "Het is officieel. Poets die rackets en sportschoenen maar op.",
    "Geregeld. Ik verwacht een waardig schouwspel op de baan.",
    "Baan gereserveerd. De tegenstander is al zenuwachtig.",
    "De kooi staat klaar voor gebruik. Tijd voor actie.",
    "Reservering voltooid. Geen excuses meer, de datum staat vast.",
    "Baan geboekt! Ik noteer 'm met gouden pen in m'n boekje.",
    "Geregeld. Tijd om te bewijzen dat je thuishoort op veld 1.",
    "De baan ligt er strak bij. Zorg dat je spel dat ook is.",
    "Bevestigd. We gaan de kooi in voor een tactische masterclass.",
];

// ── Promotie / degradatie in het groepsklassement (#302) ────────────────────
// Een tier-overgang (troon / top-3 / kelder) is promotie of degradatie. De
// tiers zijn geordend kelder < middenmoot < jager < troon; 'nieuw' doet niet
// mee (in-/uitstappen op de ladder is geen promotie). rangOvergang() vertaalt
// een (oud → nieuw)-tierpaar naar een gebeurtenis + richting.

export type RangRichting = "promotie" | "degradatie";
export type PromotieEvent = "troon" | "top3" | "uit_kelder";
export type DegradatieEvent = "troon_kwijt" | "kelder" | "uit_top3";
export type RangOvergang =
  | { richting: "promotie"; event: PromotieEvent }
  | { richting: "degradatie"; event: DegradatieEvent };

/** Classificeert een tier-overgang. null als één van beide 'nieuw' is of de
 *  tier niet wijzigt (dan is er niets te melden). Volgorde van de checks bepaalt
 *  de "sterkste" duiding: troon vóór top-3, kelder vóór de rest. */
export function rangOvergang(
  oud: string,
  nieuw: string,
): RangOvergang | null {
  if (oud === nieuw || oud === "nieuw" || nieuw === "nieuw") return null;
  if (nieuw === "troon") return { richting: "promotie", event: "troon" };
  if (oud === "troon") return { richting: "degradatie", event: "troon_kwijt" };
  if (nieuw === "kelder") return { richting: "degradatie", event: "kelder" };
  if (nieuw === "jager") return { richting: "promotie", event: "top3" };
  if (oud === "jager") return { richting: "degradatie", event: "uit_top3" };
  if (oud === "kelder") return { richting: "promotie", event: "uit_kelder" };
  return null;
}

// Promotie is positief, geen straf: één schild-neutrale pool per gebeurtenis,
// niet intensiteit-geschaald (zoals AFDROGING_LOF). Het roast-schild dempt de
// felicitatie niet — wie geen meldingen wil, zet notify_rank_change uit.
export const RANK_PROMOTIE: Record<PromotieEvent, readonly string[]> = {
  troon: [
    "Je bent de nieuwe nummer één. De troon is van jou — voorlopig.",
    "Bovenaan het klassement! Zelfs ik begin te geloven dat je kunt padellen.",
    "De koppositie is binnen. Geniet ervan, de haaien ruiken al bloed.",
    "Nummer één. M'n notitieboekje krijgt vandaag een gouden randje.",
  
    "Troon bezet. Koning van de club, al is de kroon uiterst wankel.",
    "Bovenaan! Een Trumpiaanse triomftocht langs de banen.",
    "Heerser van het klassement. De jagers zijn al onderweg.",
    "Koppositie gepakt. Een tactisch meesterwerk van formaat.",
    "De troon is van jou. Zorg dat de watersproeiers je er niet afblazen.",
    "Nummer één stand bereikt. De concurrentie kijkt groen van jaloezie.",
],
  top3: [
    "Welkom in de top-3. De troon staat nu binnen handbereik.",
    "Je bent de top-3 binnengedrongen. De koploper voelt je hijgen in z'n nek.",
    "Top-3! Nog een paar zeges en we bestormen de eerste plek.",
    "De subtop is van jou. Ik heb de aanvalsplannen al klaarliggen.",
  
    "Top-3 bereikt. Snel m'n spiekbriefjes bijwerken voor de titelstrijd.",
    "In de subtop beland. De concurrentie begint je eindelijk serieus te nemen.",
    "Top-3 positie. Uitstekende basis voor een tactische machtsgreep.",
    "Binnen de top-3. Zorg dat je forehand scherp blijft deze week.",
    "De subtop is veroverd. Nu doorstoten naar de absolute troon.",
    "Top-3 genoteerd. M'n sportpet staat extra strak van trots vandaag.",
],
  uit_kelder: [
    "Uit de kelder geklommen. De rode lantaarn geef je met plezier door.",
    "Je bent de kelder ontsnapt. Zie je wel dat je er niet thuishoorde.",
    "Weg uit de onderste regionen. De weg omhoog is ingezet.",
    "De kelderklasse achter je gelaten. Netjes — nu doorpakken.",
  
    "Weg uit de onderste regionen. De weg omhoog is eindelijk ingezet.",
    "De kelderklasse achter je gelaten. Netjes — nu doorpakken op de baan.",
    "Ontsnapt aan de kelder. De spinnen daar missen je nu al.",
    "Uit de degradatiezone geklommen. Tijd om naar de middenmoot te kijken.",
    "De kelder is verleden tijd. Een solide stap in de goede richting.",
    "Ontsnapt aan de rode lantaarn. Blijf gefocust op de basisslagen.",
    "Weg van de bodem. Mijn notitieboekje kleurt langzaam weer groen.",
    "Kelder ontsnapt. De klim omhoog is officieel begonnen vandaag.",
],
};

// Degradatie is een sneer: intensiteit-geschaald, schild aan → een neutrale,
// feitelijke regel (net als de afdroging-verliezers, #409).
export const RANK_DEGRADATIE_NEUTRAAL: Record<DegradatieEvent, readonly string[]> = {
  troon_kwijt: [
    "Je bent de koppositie kwijt. Het gebeurt de besten.",
    "De troon is overgenomen. Tijd om terug te klimmen.",
  
    "Koppositie verloren. De strijd om de eerste plek is weer open.",
    "Niet langer nummer één. Richt je vizier op de volgende match.",
    "Troon kwijt. Tijd om te analyseren waar het tactisch misging.",
    "Koppositie ingeleverd. Werk aan de winkel voor de comeback.",
    "De troon is bezet door een ander. Knok je terug naar boven.",
    "Koploperstatus verloren. De competitie blijft uiterst spannend.",
    "Niet meer bovenaan de ranglijst. Focus op de komende duels.",
    "Koppositie kwijt. De jacht is officieel weer geopend.",
],
  uit_top3: [
    "Je bent uit de top-3 gezakt. Werk aan de winkel.",
    "Net buiten de top-3 nu. De weg terug ligt open.",
  
    "Uit de subtop gevallen. Focus op de volgende speelronde.",
    "Niet langer in de top-3. Tijd om die basisslagen te herpakken.",
    "Gezakt uit de subtop. Blijf rustig trainen voor de ommekeer.",
    "Top-3 positie verloren. De stand ligt weer helemaal open.",
    "Net buiten de top-3 beland. Volgende match nieuwe kansen.",
    "Subtopstatus kwijt. Richt je blik op de klim terug naar boven.",
    "Gezakt uit de top-3. Analyseer de looplijnen kritisch.",
    "Niet meer in de top-3. De competitie is nog lang niet beslist.",
],
  kelder: [
    "Je bent in de kelder van het klassement beland. Kop op.",
    "Onderin de stand nu. De enige weg is omhoog.",
  
    "Kelderpositie bereikt. Focus op trainen en comebacks.",
    "Hekkensluiter voor nu. Blijf werken aan je spel en rating.",
    "Onderaan het klassement beland. Speel meer matches om te stijgen.",
    "In de degradatiezone terechtgekomen. Tijd voor de ommekeer.",
    "Kelderklasse van dit moment. Richt je vizier op de weg omhoog.",
    "Onderin de tabel genoteerd. Blijf gefocust op de basistechniek.",
    "Bodem van de lijst bereikt. De weg omhoog begint met de volgende service.",
    "Hekkensluiter stand. Focus op stabiele prestaties op de baan.",
],
};
export const RANK_DEGRADATIE: Record<
  DegradatieEvent,
  Record<RoastIntensiteit, readonly string[]>
> = {
  troon_kwijt: {
    mild: [
      "De troon ben je kwijt. Aan de top is het glad, zei ik toch.",
      "Niet langer nummer één. Genoten van het uitzicht?",
      "Je koppositie is ingenomen. Even bijkomen, dan terugvechten.",
    
    "Niet langer nummer één. Genoten van het uitzicht daarboven?",
    "Je koppositie is ingenomen. Even bijkomen, dan snel terugvechten.",
    "De troon is kwijt. Tijd om die forehand weer eens af te stoffen.",
    "Koppositie verloren. Mijn sportpet staat vandaag een tikje scheef van frustratie.",
    "Niet meer de koning. De jacht is geopend en jij bent nu de prooi.",
    "Troon kwijt. Gelukkig is het seizoen nog lang genoeg voor revanche.",
    "Koppositie ingeleverd. Probeer de volgende match wél te domineren.",
    "De troon is leeg (voor jou). Tijd voor een grondige tactische analyse.",
    "Niet meer op nummer één. Zorg dat je grip de volgende keer beter is.",
],
    gemeen: [
      "De troon is bezet — en niet meer door jou. Pijnlijk, hè?",
      "Van nummer één naar de achtervolgers. De haaien hadden gelijk.",
      "Je bent onttroond. M'n notitieboekje noteert het met een zucht.",
    
    "Je bent onttroond. M'n notitieboekje noteert het met een hele diepe zucht.",
    "Koppositie kwijt. Zelfs de Belgische pers zou dit een wanprestatie noemen.",
    "De troon is overgenomen. De tegenstander stuurt je een bedankkaartje.",
    "Onttroond! Ik had m'n gouden pen al klaargelegd, voor niks dus.",
    "Niet langer de baas. Zelfs de watersproeiers kijken meewarig op je neer.",
    "Troon kwijt. Je tactiek was vandaag als een persconferentie zonder geluid.",
    "Koppositie verloren. Tijd voor een crisisberaad en een flinke wissel.",
    "Onttroond. De concurrentie lacht in de kantine om jouw ratingverlies.",
],
    radioactief: [
      "Onttroond. Ik zet 'm in de groepschat, voor de eeuwigheid.",
      "De koning is dood. Lang leve wie je net voorbijstak.",
      "Van de troon gekieperd. Zo hoog geklommen om zó te vallen.",
    
    "Onttroond. Ik zet 'm in de groepschat, voor de eeuwigheid en met foto.",
    "De koning is dood. Lang leve wie je zojuist keihard voorbijstak.",
    "Van de troon gekieperd. Zo hoog geklommen om zó pijnlijk diep te vallen.",
    "Troon kwijt! We gaan de bond bellen voor een corruptie-onderzoek. Rigged!",
    "Koppositie verloren. Zelfs Gianni Infantino kan deze afgang niet meer opschorten.",
    "Onttroond! Mijn legendarische notitieboekje is spontaan in brand gevlogen.",
    "Van de troon gestoten. Zelfs Aurelio De Laurentiis lacht je nu keihard uit.",
    "Koppositie kwijt. Dit tactische moeras slokt al je overgebleven Elo op.",
    "Onttroond! Ik overweeg per direct m'n coachlicentie in de Noordzee te werpen.",
    "Troon verloren. Een Trumpiaans drama van kosmische en trieste proporties.",
],
  },
  uit_top3: {
    mild: [
      "Uit de top-3 gegleden. Gebeurt de besten, ook jou.",
      "Net buiten de subtop nu. Terugknokken maar.",
      "De top-3 liet je los. Tijd voor een tactische ommekeer.",
    
    "Uit de top-3 gegleden. Gebeurt de besten, en dus ook jou.",
    "Net buiten de subtop nu. Terugknokken is het enige devies.",
    "Gezakt uit de subtop. Zorg dat je sportschoenen de volgende keer vastzitten.",
    "Niet meer in de top-3. Mijn notitieboekje heeft een rode stift klaargelegd.",
    "Uit de subtop gezakt. Blijf trainen, de ommekeer begint vandaag.",
    "Top-3 kwijt. Geen gekke sprongen maken, gewoon stabiel blijven spelen.",
    "Net buiten de subtop. Snel m'n spiekbriefjes bijwerken voor het herstel.",
    "Gezakt naar plek vier of lager. Focus op de basisslagen deze week.",
    "Uit de top-3. Tijd om die bandeja weer eens kritisch te bekijken.",
],
    gemeen: [
      "Uit de top-3 gevallen. De jagers werden zelf opgejaagd.",
      "Weg uit de subtop. Ik had m'n pet al schuin gezet, voor niets.",
      "De top-3 spuugt je uit. Dat vraagt om zelfreflectie.",
    
    "Uit de top-3 gevallen. De jagers werden vandaag zelf genadeloos opgejaagd.",
    "Weg uit de subtop. Ik had m'n pet al schuin gezet, voor helemaal niets.",
    "De top-3 spuugt je uit. Dat vraagt om een hele diepe zelfreflectie.",
    "Gezakt uit de top-3. Je partner verdient een standbeeld voor diens engelengeduld.",
    "Weg uit de subtop. Zelfs de kantinejuffrouw vraagt waar je tactiek gebleven is.",
    "Uit de top-3 geknikkerd. Ik schrijf me suf in m'n boekje over je blunders.",
    "Subtopstatus kwijt. De tegenstander bedankte je voor de makkelijke punten.",
    "Gezakt. Je speelde vandaag met de intensiteit van een slaperige slak.",
    "Uit de top-3 gevallen. Zelfs de wind had vandaag een beter tactisch plan.",
    "Weg uit de subtop. Jouw verdediging leek op een Zwitserse gatenkaas.",
],
    radioactief: [
      "Uit de top-3 geknikkerd. Van jager naar prooi in één match.",
      "De subtop is je ontglipt. Ik heb er een boos krabbeltje over gemaakt.",
      "Weg uit de top-3. Zo snel gezakt dat de statistieken duizelig werden.",
    
    "Uit de top-3 geknikkerd. Van jager naar prooi in slechts één match.",
    "De subtop is je ontglipt. Ik heb er een heel boos krabbeltje over gemaakt.",
    "Weg uit de top-3. Zo snel gezakt dat de statistieken er duizelig van worden.",
    "Subtop verloren! We eisen direct een hertelling van alle Elo-punten. Fake stats!",
    "Uit de top-3 gestort. Zelfs m'n chique trainingspak weigert nog naast je te hangen.",
    "Top-3 kwijt! Dit tactische debacle is groter dan de mislukte persconferenties.",
    "Uit de subtop gedonderd. Zelfs de sproeiers weigeren water aan je te verspillen.",
    "Gezakt uit de top-3. Ik noteer dit onder het hoofdstuk 'volledig mislukte omschakeling'.",
    "Uit de subtop geknikkerd. Zelfs Infantino schudt beschaamd z'n hoofd na deze match.",
    "Top-3 kwijt. Een afstorting van historische, radioactieve en illegale proporties.",
],
  },
  kelder: {
    mild: [
      "Afgezakt naar de kelder. De enige weg is nu omhoog.",
      "In de onderste regionen beland. Kop op, comebacks bestaan.",
      "De kelder in. Niks dat een paar zeges niet oplossen.",
    
    "Afgezakt naar de kelder. De enige weg is nu gelukkig omhoog.",
    "In de onderste regionen beland. Kop op, comebacks bestaan echt.",
    "De kelder in. Niks dat een paar goede zeges niet kunnen oplossen.",
    "Hekkensluiter voor nu. Blijf trainen, de ommekeer begint op de bodem.",
    "In de kelder beland. Zorg dat je racket de volgende keer wél stroef is.",
    "Kelderklasse bereikt. Mijn spiekbriefjes liggen al klaar voor de klim.",
    "Afgezakt naar onderen. Kop op, de competitie is nog lang genoeg.",
    "In de onderste regionen. Tijd om die basisslagen nog eens door te nemen.",
    "Kelderbewoner geworden. Blijf gefocust en vermijd de kooiwanden.",
    "Afgezakt. Zorg dat je gripje de volgende match wél in orde is.",
],
    gemeen: [
      "Welkom in de kelder. De rode lantaarn staat je verrassend goed.",
      "Afgezakt naar de onderkant. Zelfs de watersproeiers kijken meewarig.",
      "De kelder in gezakt. Ik zet alvast koffie voor de lange klim terug.",
    
    "Afgezakt naar de onderkant. Zelfs de watersproeiers kijken meewarig toe.",
    "De kelder in gezakt. Ik zet alvast koffie voor de hele lange klim terug.",
    "Kelderklasse bereikt. Je partner verdient een standbeeld en jij een cursus motoriek.",
    "Onderaan beland. De tegenstander stuurde me zojuist een bedankkaartje.",
    "In de kelder gezakt. Ik overweeg serieus je rackets in te ruilen voor minigolfclubs.",
    "Hekkensluiter. Zelfs de kantinebaas vraagt of je de goede kant wel op slaat.",
    "Kelderklasse. Mijn legendarische Lille-notities hebben spontaan de moed opgegeven.",
    "Afgezakt naar de bodem. Zelfs m'n chique sportpet kan deze afgang niet verbergen.",
    "Welkom in de kelder. Ik noteer deze afdaling met een hele diepe, zware zucht.",
],
    radioactief: [
      "De kelder in gedonderd. Dit hoort in een museum — vitrine, spotje erop.",
      "Hekkensluiter nu. Ik heb m'n viool gestemd, hij speelt zachtjes voor je.",
      "Vrije val naar de bodem. Ik noteer 'm met sadistisch genoegen.",
    
    "De kelder in gedonderd. Dit hoort in een museum — vitrine, spotje erop en entree heffen.",
    "Vrije val naar de absolute bodem. Ik noteer 'm met sadistisch genoegen.",
    "De kelder in gestort! We gaan Infantino bellen voor een voorwaardelijke degradatie-opschorting.",
    "Bodem van de afgrond. Zelfs de marine weigert zo diep te duiken voor je Elo.",
    "Hekkensluiter! Ik overweeg per direct m'n coachlicentie in de Noordzee te werpen.",
    "Kelder in gedonderd. Zelfs de spinnen hier kruipen weg uit pure plaatsvervangende schaamte.",
    "Bodem van de lijst. Zelfs een standbeeld van De Laurentiis had meer punten gesprokkeld.",
    "Allerlaatste nu. Dit is geen degradatie, dit is een regelrechte misdaad tegen de padelsport.",
    "Kelderbewoner! Ik trek m'n chique sportpet zo diep over m'n ogen van pure schaamte.",
],
  },
};
