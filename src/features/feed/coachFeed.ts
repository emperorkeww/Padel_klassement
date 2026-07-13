// Coach Rudy in de feed (#183): de commentator reageert op de sáppige
// gebeurtenissen — pias van de week/maand, kampioenen, promoties/degradaties en
// matches met een upset, bagel, monsterzege of winreeks. Mundane items (polls,
// vriendschappen, groepsnieuws) laat hij bewust links liggen, anders wordt de
// feed ruis. Alles deterministisch geseed zodat de hele groep dezelfde quip
// ziet; roast-quips respecteren de groepsintensiteit en het roast-schild.
// Pure functie, getest in coachFeed.test.ts.

import type { FeedEvent } from "../../lib/feed";
import type { Match, Profile, RoastIntensiteit, Team } from "../../lib/types";
import type { CoachMood } from "../../lib/roastTone";
import { coachSneer, kiesUniek, roastCtx, roastSeed } from "../../lib/roastTone";
import {
  isWinreeksRecord,
  piasNrDezeMaand,
  verliesFeiten,
  type VerliesFeiten,
} from "../../lib/coachStats";

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

// Niet-roast pools (hype/felicitatie/leedvermaak): niet door het schild
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
] as const;

const REEKS = [
  "Niet meer te stoppen, die. Voorlopig.",
  "Op dreef! Iemand moet er een stok tussen steken.",
  "Reeks na reeks. Geniet, tot de harde klap komt.",
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
] as const;

const BAGEL = [
  "Een droge 6-0. Nul games. Iemand mag zich diep schamen.",
  "6–0. Dat is geen wedstrijd, dat is een openbare terechtstelling.",
  "Pandoering gekregen. Droge 6-0. Koud opgediend.",
  "Een droge 6-0... Hebben jullie überhaupt wel je racket uit de tas gehaald?",
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
] as const;

export const KAMPIOEN_NEUTRAAL = [
  "Kampioen. Sterke reeks, helder resultaat.",
  "Titel binnen. Netjes afgewerkt.",
  "Bovenaan geëindigd. Dat mag gezien worden.",
  "Kampioen van de groep. Verdiend op basis van de cijfers.",
] as const;

const PROMOTIE_NEUTRAAL = [
  "Een divisie hoger. Sterk geklommen.",
  "Promotie genoteerd. De lijn gaat omhoog.",
  "Opgeschoven naar een hoger niveau.",
  "Netjes gestegen op de ladder.",
] as const;

const DEGRADATIE_NEUTRAAL = [
  "Een divisie lager. Tijd om rustig opnieuw op te bouwen.",
  "Gezakt in het klassement. De volgende match telt weer.",
  "Een stap terug in de stand.",
  "De lijn ging omlaag, maar het seizoen loopt door.",
] as const;

const BAGEL_NEUTRAAL = [
  "6–0. Duidelijke uitslag, snel door naar de volgende.",
  "Een eenzijdige set. De cijfers zijn helder.",
  "Nul games op het bord. Volgende match nieuwe kans.",
  "Broodje bal op papier, neutraal genoteerd.",
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
  return [loser.player1_id, loser.player2_id].some((id) => heeftSchild(ctx.profiles[id]));
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
    case "season-champion":
      return kiesUniek(
        heeftSchild(ctx.profiles[event.playerId]) ? KAMPIOEN_NEUTRAAL : KAMPIOEN,
        roastSeed(event.playerId, event.seasonLabel),
        g,
      );
    case "rank": {
      const omhoog =
        event.shift === "nieuw" ||
        (typeof event.shift === "number" && event.shift > 0);
      const beschermd = heeftSchild(ctx.profiles[event.playerId]);
      return kiesUniek(
        omhoog
          ? beschermd
            ? PROMOTIE_NEUTRAAL
            : PROMOTIE
          : beschermd
            ? DEGRADATIE_NEUTRAAL
            : DEGRADATIE,
        roastSeed(event.playerId, event.at),
        g,
      );
    }
    case "match": {
      const seed = roastSeed(event.match.id);
      const h = event.highlights;
      const teams = ctx.teams ?? {};
      const magRoasten = !verliezersHebbenSchild(event, ctx);
      // Nederlaag-feiten één keer afleiden (loser-perspectief), als de matchlijst
      // is meegegeven; anders blijft alles op de generieke pools.
      const vf = ctx.matches ? verliesFeiten(event.match, ctx.matches, teams, ctx.naamVoor) : null;

      if (h.some((x) => x.type === "streak" || x.type === "duo")) {
        return kiesFeit(reeksFeiten(event, ctx), seed, g) ?? kiesUniek(REEKS, seed, g);
      }
      if (h.some((x) => x.type === "upset")) {
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
    case "match": {
      const h = event.highlights;
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
