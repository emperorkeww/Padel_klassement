// Coach Rudy als presentator door de Wrapped (#295): per kaartsoort één
// deterministische regel + bijpassende mood-illustratie, en een afsluitend
// eindoordeel over het hele jaar. Zelfde patroon als coachMoments/coachAvond:
// string-pools + roastSeed/kiesUniek, schild-gate eerst (plagen, geen kwetsen),
// puur en getest. De tekst is viewer-afhankelijk (schild/intensiteit) en wordt
// daarom hier — in de presentatielaag — gegenereerd, niet in de kaartdata.

import {
  kiesUniek,
  type CoachMood,
  type RoastCtx,
} from "@/features/coach/roastTone";
import type {
  WrappedCard,
  WrappedJaarStats,
  WrappedPeriode,
} from "@/features/wrapped/wrapped";

export interface CoachRegel {
  tekst: string;
  mood: CoachMood;
}

// ── Kwartaal-Wrapped (#712) ──────────────────────────────────────────────────
//
// Rudy's pools zijn geschreven voor een jáároverzicht: ze zeggen "volgend
// jaar", "de jaarrekening", "een heel jaar". In een Herfst Wrapped klopt dat
// niet. Twee ingrepen, elk waar hij het meest oplevert:
//
//  1. De kaarten waar Rudy het kader zet — cover, outro, seizoenskaart — en de
//     nieuwe slachtoffer-kaart krijgen eigen kwartaal-pools. Daar is de tekst
//     structureel over het tijdvak, dus daar is bespoke copy het waard.
//  2. Voor alle andere pools (en het hele eindoordeel) filtert `zonderJaar` de
//     regels weg die "jaar" bevatten. Zo hoeft geen enkele pool verdubbeld te
//     worden en glipt er nooit een "volgend jaar" in een kwartaaloverzicht. In
//     elke pool blijft minstens één regel over; mocht dat ooit niet zo zijn,
//     dan valt de filter terug op de volle pool (liever een jaar-woord dan
//     geen regel).
const JAAR_WOORD = /jaar/i;

function zonderJaar(pool: readonly string[], soort: WrappedPeriode["soort"]) {
  if (soort === "jaar") return pool;
  const over = pool.filter((r) => !JAAR_WOORD.test(r));
  return over.length > 0 ? over : pool;
}

/** Mood van een burn: het schild dempt tot het neutrale portret, anders volgt
 *  de illustratie de groepsintensiteit. */
const burnMood = (ctx: RoastCtx): CoachMood => (ctx.schild ? "portret" : ctx.intensiteit);

// ── Pools per kaartsoort ─────────────────────────────────────────────────────
const COVER = [
  "Daar is het dan: jouw jaar in cijfers. Ik heb m'n leesbril al opgezet.",
  "Welkom bij de terugblik. Ik praat je door de hoogte- én dieptepunten.",
  "Een heel seizoen in een handvol kaarten. Zet je schrap.",
  "Ik heb m'n notitieboekje van dit jaar er nog eens bij gepakt. Boeiende lectuur.",
  "Jouw padeljaar, becommentarieerd door ondergetekende. Een eer, uiteraard.",
  "Tijd voor de jaarrekening. Geen zorgen, ik tel de nederlagen maar één keer.",
  "De statistieken van een heel jaar. Tijd voor de onthulling.",
  "Jouw jaaroverzicht. Laten we kijken of er nog wat tactiek tussen zat.",
] as const;

const VOLUME_HOOG = [
  "Zoveel potten én een nette winrate? Ik noteer dit bij de zeldzame lichtpuntjes.",
  "Een indrukwekkend aantal matches. Je woont zowat op de baan.",
  "Volume én rendement. Dat schrijf ik met een groene pen op, voor de verandering.",
  "Niet te stoppen op de baan. Je racket heeft amper rust gehad.",
  "Indrukwekkend volume. De kooi is zowat je tweede adres.",
] as const;
const VOLUME_MID = [
  "Een keurig aantal matches. De middenmoot van de inzet, zullen we maar zeggen.",
  "Genoeg gespeeld om een oordeel te vormen. Dat oordeel volgt zo.",
  "Netjes gevuld seizoen. De kwantiteit zat wel snor.",
  "Een stabiel aantal matches. Een degelijk seizoen.",
  "Regelmatig gespeeld. Goed voor de fitheid, prima.",
] as const;
const VOLUME_LAAG = [
  "Al die matches en tóch die winrate? Kwantiteit is duidelijk je ding, kwaliteit iets minder.",
  "Zoveel gespeeld, zo weinig gewonnen. Mijn pen raakte er bijna van leeg.",
  "Veel baan-tijd, weinig zeges. Volgend jaar minder volume, meer tactiek.",
  "Te veel verloren voor het aantal matches dat je speelde. Tijd voor training.",
  "De kwantiteit was hoog, maar m'n notitieboekje schreeuwde om kwaliteit.",
] as const;
const VOLUME_NEUTRAAL = [
  "Een mooi aantal matches dit jaar. Elke pot telt.",
  "Lekker veel gespeeld. Zo hoort het.",
  "Een goedgevuld padeljaar. Chapeau voor de inzet.",
  "Een mooi seizoen achter de rug. Op naar de volgende matches.",
  "Elke match heeft bijgedragen aan de cijfers. Netjes.",
] as const;

const KALENDER = [
  "Een duidelijk ritme in je seizoen. Ik hou van een speler met een agenda.",
  "Je drukste maand spreekt boekdelen. Toen stond de baan in brand.",
  "Zo te zien had je een favoriete speeldag. Gewoontedier, en dat siert je.",
  "Een mooi patroon in de planning. Regelmaat is het halve werk.",
  "Een prachtig patroon. Een speler die leeft for de vaste padelmomenten.",
  "De maanden vlogen voorbij op de baan. Regelmaat siert de speler.",
] as const;

const REEKS_WINST = [
  "Die winreeks noteer ik met hoofdletters. Even niet te veel naar je hoofd laten stijgen.",
  "Op rij winnen is een kunst. Deze keer eentje die je echt beheerste.",
  "Een reeks om trots op te zijn. Ik heb 'm dubbel onderstreept.",
  "Zo'n reeks bouw je niet met geluk alleen. Petje af — een échte pet.",
  "Een winreeks om in te lijsten. Meesterlijk gedaan.",
  "Onstuitbaar tijdens je beste reeks. Dat noteer ik met plezier.",
] as const;
const REEKS_VERLIES = [
  "Die verliesreeks kleurde m'n notitieboekje aardig rood. Maar je bleef terugkomen.",
  "Een pijnlijke reeks. Karakter opbouwen, noemen ze dat. Heel véél karakter.",
  "Zo'n reeks doet pijn aan de ogen. Gelukkig krabbelde je er weer bovenop.",
  "De donkerste periode van je jaar. Ik heb er een heel hoofdstuk over geschreven.",
  "Een reeks nederlagen die we snel gaan vergeten. Of juist analyseren.",
  "Die verliesreeks was pijnlijk, maar je toonde ruggengraat.",
] as const;

const MAATJE = [
  "Jij en je vaste maatje: een duo waar zelfs ik jaloers op word.",
  "Een gouden koppel. Samen sta je duidelijk sterker.",
  "Met dit maatje aan je zij ging het een stuk beter. Koester die klik.",
  "Een partnerschap uit het tactische boekje. Blijven doen.",
  "Een fantastisch duo. Samen de baan domineren.",
  "Rotsvaste chemie met je partner. Een genot om te zien.",
] as const;

const RIVAAL_FAVORIET = [
  "Je favoriete tegenstander mag je dankbaar zijn voor het entertainment. Jij hem voor de punten.",
  "Sommige tegenstanders zijn gewoon een cadeautje. Jij weet welke.",
  "Tegen deze speler kwam je best op dreef. Blijf hem uitnodigen.",
  "Tegen deze rivaal liep het gesmeerd. Blijf hem uitdagen.",
  "Puntenpakker tegen je favoriete tegenstander. Lekker.",
] as const;
const RIVAAL_NEMESIS = [
  "En dan die angstgegner. Zelfs ik kreeg hoofdpijn van die confrontaties.",
  "Iedereen heeft een nemesis. De jouwe zit duidelijk in je hoofd.",
  "Tegen die ene tegenstander wil het maar niet lukken. Huiswerk voor volgend jaar.",
  "Je nemesis had de overhand. Huiswerk voor de komende trainingen.",
  "Angstgegner op papier en op de baan. Tijd voor revanche.",
] as const;
const RIVAAL_MIX = [
  "Een favoriet én een angstgegner. Zo hoort een rivaliteit eruit te zien.",
  "De een geeft je punten, de ander grijze haren. Balans in alles.",
  "Je vrienden en je vijanden op de baan. Beiden even leerzaam.",
  "Rivaliteiten die het seizoen kleur gaven. Dat is sport.",
  "Je vrienden en je vijanden. De balans was perfect.",
] as const;

const PRESTATIE = [
  "Dít moment lijst ik in. Even bewijzen dat je het écht kunt.",
  "Je sterkste moment van het jaar. Zelfs mijn kritische pen viel stil.",
  "Hier liet je zien waartoe je in staat bent. Doe dat vaker.",
  "Een hoogtepunt om te bewaren. Ik zet 'm bij m'n eigen masterplans in de kast.",
  "Een moment van absolute glorie. Dit blijft me bij.",
  "Je absolute hoogtepunt. Zelfs ik stond te klappen.",
] as const;

const RATING_UP = [
  "Je rating klom netjes. Ik durf bijna te zeggen dat het geen toeval was.",
  "De cijfers gingen omhoog. Blijf op dit spoor en ik word nog aardig ook.",
  "Rating in de lift. Dat noteer ik met een tevreden krabbel.",
  "Rating in stijgende lijn. De vooruitgang is heel duidelijk.",
  "Elo omhoog. De trainingen werpen hun vruchten af.",
] as const;
const RATING_DOWN = [
  "Je rating zakte wat weg. We noemen het een investering in volgend jaar.",
  "De curve wees naar beneden. Tijd voor een tactische heropbouw.",
  "Rating in mineur. Geen ramp — het punt is dat je weer stijgt.",
  "Rating gezakt. Een tijdelijke dip voor een grote sprong volgend jaar.",
  "Curve naar beneden. Tijd om de looplijnen opnieuw te bestuderen.",
] as const;
const RATING_FLAT = [
  "Je rating bleef stabiel. Betrouwbaar, zoals een goede bondscoach.",
  "Weinig beweging in de cijfers. Stabiliteit heeft ook z'n charme.",
  "Rating netjes op koers gehouden. Nu de volgende stap nog.",
  "Rating stabiel gehouden. Een betrouwbare prestatie.",
  "Weinig schommelingen. Stabiliteit als stevig fundament.",
] as const;

const BADGE = [
  "Een zeldzame vangst. Daar mag je stiekem best trots op zijn.",
  "Deze badge haalt bijna niemand. Jij dus wel. Chapeau.",
  "Een unieke prestatie in de collectie. Ik knik goedkeurend.",
  "Een zeldzame prestatie. Chapeau voor deze badge.",
  "Unieke vangst in je collectie. Dat mag gevierd.",
] as const;

const OUTRO = [
  "En dat was jouw jaar. Ik ga m'n notitieboekje bijwerken voor het volgende.",
  "Tot zover de terugblik. Op naar een seizoen met nog meer verhalen.",
  "Einde van de rit. Deel 'm met je maatjes — ik ben benieuwd naar de reacties.",
  "Zo, dat was het jaar. Volgend seizoen sta ik er weer, pen in de aanslag.",
  "Tot zover het jaaroverzicht. M'n pen ligt al klaar voor het nieuwe seizoen.",
  "Einde van de terugblik. Laten we er volgend jaar weer tegenaan gaan.",
] as const;

/** Seizoenskaart (#498): de FUT-schildkaart als slot van de presentatie, na
 *  de outro en het eindoordeel — dus bewust een ander register dan die twee:
 *  geen terugblik meer, maar het overhandigen van de kaart zelf. */
const SEIZOENSKAART = [
  "En hier is-ie dan: jouw eigen seizoenskaart. Zelfs ik geef toe dat dat er goed uitziet.",
  "De officiële kaart van dit seizoen. Laminaat 'm, of gewoon delen — ik vind het allebei best.",
  "Team of the Season, editie jouw naam. Verdiend, na dit hele verhaal.",
  "Deze kaart is nu voor altijd van jou. Bewaar 'm goed, ik teken volgend jaar een nieuwe.",
  "De collectible van het jaar. Draag 'm met dezelfde overtuiging als op de baan.",
] as const;

/** Kwartaal-varianten (#712) van de kaarten waar Rudy het kader zet. */
const COVER_SEIZOEN = [
  "Daar is het dan: jouw kwartaal in cijfers. Ik heb m'n leesbril al opgezet.",
  "Eén seizoen, een handvol kaarten. Zet je schrap.",
  "Ik heb m'n notitieboekje van dit seizoen er nog eens bij gepakt. Boeiende lectuur.",
  "Jouw seizoen, becommentarieerd door ondergetekende. Een eer, uiteraard.",
  "Tijd voor de seizoensrekening. Geen zorgen, ik tel de nederlagen maar één keer.",
  "De statistieken van drie maanden padel. Tijd voor de onthulling.",
] as const;

const OUTRO_SEIZOEN = [
  "En dat was jouw seizoen. Ik ga m'n notitieboekje bijwerken voor het volgende.",
  "Tot zover de terugblik. Op naar een kwartaal met nog meer verhalen.",
  "Einde van de rit. Deel 'm met je maatjes — ik ben benieuwd naar de reacties.",
  "Zo, dat was het seizoen. Volgend kwartaal sta ik er weer, pen in de aanslag.",
  "Tot zover het seizoensoverzicht. M'n pen ligt al klaar voor het volgende.",
] as const;

const SEIZOENSKAART_SEIZOEN = [
  "En hier is-ie dan: jouw kaart van dit seizoen. Zelfs ik geef toe dat dat er goed uitziet.",
  "De officiële kaart van dit kwartaal. Laminaat 'm, of gewoon delen — ik vind het allebei best.",
  "Team of the Season, editie jouw naam. Verdiend, na dit hele verhaal.",
  "Deze kaart is nu voor altijd van jou. Bewaar 'm goed, ik teken er volgend seizoen een nieuwe.",
  "De collectible van het seizoen. Draag 'm met dezelfde overtuiging als op de baan.",
] as const;

/** Slachtoffer-kaart (#712): de favoriete tegenstander van het kwartaal. */
const SLACHTOFFER = [
  "Deze tegenstander mag je dankbaar zijn voor het entertainment. Jij hem voor de punten.",
  "Sommige tegenstanders zijn gewoon een cadeautje. Jij weet welke.",
  "Tegen deze speler kwam je steevast op dreef. Blijf hem uitnodigen.",
  "Jouw favoriete slachtoffer. Ik noteer 'm met een vriendelijke krabbel.",
  "Tegen hem liep het gesmeerd. Zet hem maar weer op de lijst.",
] as const;

/**
 * Coach Rudy's regel + mood voor één Wrapped-kaart. Deterministisch op `seed`;
 * met een gedeelde `gebruikt`-set komt geen regel twee keer voor in één deck.
 * Het roast-schild dempt de burns tot een neutrale toon (portret-illustratie).
 * `soort` kiest tussen de jaar- en kwartaal-copy (#712).
 */
export function coachWrappedRegel(
  card: WrappedCard,
  ctx: RoastCtx,
  seed: number,
  gebruikt?: Set<string>,
  soort: WrappedPeriode["soort"] = "jaar",
): CoachRegel {
  const kies = (pool: readonly string[]) =>
    kiesUniek(zonderJaar(pool, soort), seed, gebruikt);
  const seizoen = soort === "seizoen";
  switch (card.kind) {
    case "cover":
      return { tekst: kies(seizoen ? COVER_SEIZOEN : COVER), mood: "portret" };
    case "slachtoffer":
      return { tekst: kies(SLACHTOFFER), mood: "trots" };
    case "volume": {
      const wr = card.winrate;
      if (ctx.schild || wr == null) return { tekst: kies(VOLUME_NEUTRAAL), mood: "portret" };
      if (wr >= 55) return { tekst: kies(VOLUME_HOOG), mood: "trots" };
      if (wr < 45) return { tekst: kies(VOLUME_LAAG), mood: burnMood(ctx) };
      return { tekst: kies(VOLUME_MID), mood: "portret" };
    }
    case "kalender":
      return { tekst: kies(KALENDER), mood: "portret" };
    case "reeks":
      return card.type === "winst"
        ? { tekst: kies(REEKS_WINST), mood: "trots" }
        : ctx.schild
          ? { tekst: kies(REEKS_VERLIES), mood: "portret" }
          : { tekst: kies(REEKS_VERLIES), mood: card.lengte >= 5 ? "radioactief" : ctx.intensiteit };
    case "maatje":
      return { tekst: kies(MAATJE), mood: "trots" };
    case "rivalen":
      if (card.favoriet && !card.nemesis)
        return { tekst: kies(RIVAAL_FAVORIET), mood: "trots" };
      if (card.nemesis && !card.favoriet)
        return { tekst: kies(RIVAAL_NEMESIS), mood: burnMood(ctx) };
      return { tekst: kies(RIVAAL_MIX), mood: "portret" };
    case "prestatie":
      return { tekst: kies(PRESTATIE), mood: "trots" };
    case "rating":
      if (card.eind > card.start) return { tekst: kies(RATING_UP), mood: "trots" };
      if (card.eind < card.start) return { tekst: kies(RATING_DOWN), mood: burnMood(ctx) };
      return { tekst: kies(RATING_FLAT), mood: "portret" };
    case "badge":
      return { tekst: kies(BADGE), mood: "trots" };
    case "outro":
      return { tekst: kies(seizoen ? OUTRO_SEIZOEN : OUTRO), mood: "portret" };
    case "eindoordeel":
      // De eindoordeel-kaart heeft z'n eigen generator (coachEindoordeel); dit
      // is enkel een veilige terugval als hij toch hierlangs komt.
      return { tekst: kies(seizoen ? OUTRO_SEIZOEN : OUTRO), mood: "portret" };
    case "seizoenskaart":
      return {
        tekst: kies(seizoen ? SEIZOENSKAART_SEIZOEN : SEIZOENSKAART),
        mood: "trots",
      };
  }
}

// ── Eindoordeel: het jaarrapport ─────────────────────────────────────────────
const EIND_KOP_LOF = [
  "Coach Rudy's Eindoordeel: geslaagd",
  "Het rapport ligt klaar: dik voldoende",
  "Mijn eindconclusie: knap gedaan",
  "Coach Rudy's Eindoordeel: meesterlijk",
  "Mijn eindrapport: uiterst succesvol",
] as const;
const EIND_KOP_MID = [
  "Coach Rudy's Eindoordeel: ruim voldoende",
  "Het rapport ligt klaar: netjes",
  "Mijn eindconclusie: prima basis",
  "Coach Rudy's Eindoordeel: stabiel jaar",
  "Mijn eindconclusie: degelijk seizoen",
] as const;
const EIND_KOP_SNEER = [
  "Coach Rudy's Eindoordeel: werk aan de winkel",
  "Het rapport ligt klaar: onvoldoende",
  "Mijn eindconclusie: terug de trainingsbank op",
  "Coach Rudy's Eindoordeel: dramatisch",
  "Mijn eindrapport: zware tekortkomingen",
] as const;

const EIND_WINRATE_HOOG = [
  "Je hebt gewonnen, ja. Maar tactisch vond ik het ongeorganiseerd. Volgend jaar begin je gewoon weer op de bank.",
  "Een prima winrate. Ik weiger alleen te geloven dat er geen geluk bij zat.",
  "Je won vaker dan je verloor. Zeldzaam, en ik gun het je — deze ene keer.",
  "Een indrukwekkend winpercentage. Ik zet 'm met een trotse glimlach in het jaarboek.",
  "Je hebt de overhand gehad dit jaar. Heel netjes gedaan, al mag de service nog strakker.",
] as const;
const EIND_WINRATE_MID = [
  "Je winrate hangt precies rond het midden. Veilig, grijs, en nét niet indrukwekkend.",
  "Winst en verlies in evenwicht. De diplomatieke uitslag van een bange speler.",
  "Fiftyfifty ongeveer. Volgend jaar wil ik die balans richting winst zien kantelen.",
  "Stabiel in het midden. Niets om je voor te schamen, niets om over op te scheppen.",
  "Precies gemiddeld. Volgend jaar de tactiek wat scherper zetten voor de winst.",
] as const;
const EIND_WINRATE_LAAG = [
  "Mijn notitieboekje zit vol met rode strepen door jouw toedoen. Volgend jaar fungeer je uitsluitend als ballenjongen.",
  "Meer verloren dan gewonnen. Ik heb er een aparte, dikke map voor aangelegd.",
  "Die winrate deed pijn aan m'n ogen. We beginnen volgend jaar helemaal opnieuw.",
  "Dit jaaroverzicht deed pijn aan m'n ogen. Zoveel rode cijfers is bijna een kunst.",
  "De grafiek ging genadeloos omlaag. Tijd voor een totale tactische heroverweging.",
] as const;
const EIND_WINRATE_SCHILD = [
  "Je hebt een heel seizoen volgemaakt. Dat verdient sowieso een pluim.",
  "De inzet zat er het hele jaar in. Daar houd ik van.",
  "Een compleet padeljaar op de teller. Chapeau voor het doorzetten.",
  "Een heel jaar strijd geleverd op de baan. Klasse inzet.",
  "Elke match heeft bijgedragen aan dit jaaroverzicht. Chapeau.",
] as const;

const EIND_WINST = [
  "Die langste winreeks blijft me bij — even leek je onstuitbaar.",
  "Je beste reeks liet zien wat er in je zit. Nu vaker.",
  "Die winstreak liet zien hoe dominant je kunt zijn. Probeer dat vast te houden.",
  "Je langste reeks overwinningen was een absoluut hoogtepunt dit seizoen.",
] as const;
const EIND_VERLIES = [
  "En dan die verliesreeks... daar hebben we het volgend jaar niet meer over, afgesproken?",
  "Je langste verliesreeks vulde in m'n boekje een treurig hoofdstuk.",
  "Die verliesreeks was een zware test. Maar je bleef wel vechten.",
  "M'n spiekbriefje kleurde rood tijdens je mindere periode, maar je herpakte je.",
] as const;
const EIND_BAGEL_VOOR = [
  "Een paar keer een 6-0 uitgedeeld. Genadeloos — dat mag ik wel.",
  "Je deelde zowaar wat bagels uit. Daar krijg ik trek in.",
  "Bagels uitdelen is het lekkerst wat er is. Zorg dat je er volgend jaar nog meer bakt.",
] as const;
const EIND_BAGEL_TEGEN = [
  "Een paar keer met 0-6 ingemaakt. Die avonden slaan we stilletjes over.",
  "Je slikte wat bagels. Volgend jaar staan die aan de óverkant, hoop ik.",
  "Die bagels tegen waren pijnlijk. Volgend jaar beter opletten aan het net.",
] as const;
const EIND_RATING_UP = [
  "Je rating klom door het jaar heen. De grafiek wijst de goede kant op.",
  "Onder de streep ging je rating vooruit. Dat telt.",
  "Een stijgende rating over het hele jaar. De weg omhoog is ingezet.",
] as const;
const EIND_RATING_DOWN = [
  "Je rating zakte over het jaar. Beschouw het als aanloop naar de comeback.",
  "De rating eindigde lager dan hij begon. Werk aan de winkel.",
  "Ratingverlies over het jaar. Tijd voor een frisse start volgend seizoen.",
] as const;

/**
 * Coach Rudy's afsluitende rapport (#295): een kop + 2-3 regels langs de assen
 * winrate, reeksen, bagels en rating. Deterministisch op `seed`; het
 * roast-schild verzacht het tot een oprecht, positief slot (mood portret).
 * `soort` houdt de jaar-woorden uit een kwartaalrapport (#712).
 */
export function coachEindoordeel(
  stats: WrappedJaarStats,
  ctx: RoastCtx,
  seed: number,
  soort: WrappedPeriode["soort"] = "jaar",
): { kop: string; regels: string[]; mood: CoachMood } {
  const gebruikt = new Set<string>();
  const pick = (pool: readonly string[], n: number) =>
    kiesUniek(zonderJaar(pool, soort), (seed + n * 101) | 0, gebruikt);
  const wr = stats.winrate;
  const regels: string[] = [];

  // As 1 — winrate (altijd). Bepaalt meteen de toon van het rapport.
  let kop: string;
  let mood: CoachMood;
  if (ctx.schild || wr == null) {
    regels.push(pick(EIND_WINRATE_SCHILD, 1));
    kop = pick(EIND_KOP_MID, 0);
    mood = "portret";
  } else if (wr >= 55) {
    regels.push(pick(EIND_WINRATE_HOOG, 1));
    kop = pick(EIND_KOP_LOF, 0);
    mood = "trots";
  } else if (wr < 45) {
    regels.push(pick(EIND_WINRATE_LAAG, 1));
    kop = pick(EIND_KOP_SNEER, 0);
    mood = ctx.intensiteit;
  } else {
    regels.push(pick(EIND_WINRATE_MID, 1));
    kop = pick(EIND_KOP_MID, 0);
    mood = "portret";
  }

  // As 2 — de meest sprekende reeks (winst of verlies).
  if (stats.langsteVerlies >= 3 && stats.langsteVerlies >= stats.langsteWinst) {
    regels.push(pick(ctx.schild ? EIND_WINST : EIND_VERLIES, 2));
  } else if (stats.langsteWinst >= 3) {
    regels.push(pick(EIND_WINST, 2));
  }

  // As 3 — bagels, of anders de rating-reis, tot maximaal drie regels.
  if (regels.length < 3) {
    if (stats.bagelsTegen > stats.bagelsVoor && !ctx.schild) {
      regels.push(pick(EIND_BAGEL_TEGEN, 3));
    } else if (stats.bagelsVoor > 0) {
      regels.push(pick(EIND_BAGEL_VOOR, 3));
    } else if (stats.ratingDelta != null && stats.ratingDelta !== 0) {
      regels.push(pick(stats.ratingDelta > 0 ? EIND_RATING_UP : EIND_RATING_DOWN, 4));
    }
  }

  return { kop, regels, mood };
}
