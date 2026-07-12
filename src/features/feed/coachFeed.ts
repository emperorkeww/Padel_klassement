// Coach Rudy in de feed (#183): de commentator reageert op de sáppige
// gebeurtenissen — pias van de week/maand, kampioenen, promoties/degradaties en
// matches met een upset, bagel, monsterzege of winreeks. Mundane items (polls,
// vriendschappen, groepsnieuws) laat hij bewust links liggen, anders wordt de
// feed ruis. Alles deterministisch geseed zodat de hele groep dezelfde quip
// ziet; roast-quips respecteren de groepsintensiteit en het roast-schild.
// Pure functie, getest in coachFeed.test.ts.

import type { FeedEvent } from "../../lib/feed";
import type { Profile, RoastIntensiteit, Team } from "../../lib/types";
import type { CoachMood } from "../../lib/roastTone";
import { coachSneer, kiesUniek, roastCtx, roastSeed } from "../../lib/roastTone";

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
}

// Niet-roast pools (hype/felicitatie/leedvermaak): niet door het schild
// beperkt, want het is commentaar op een gebeurtenis, geen persoonlijke sneer.
const KAMPIOEN = [
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
] as const;

const BAGEL = [
  "Een bagel. Nul games. Iemand mag zich diep schamen.",
  "6–0. Dat is geen wedstrijd, dat is een openbare terechtstelling.",
  "Broodje bagel geserveerd. Koud opgediend.",
  "Een bagel... Hebben jullie überhaupt wel je racket uit de tas gehaald?",
  "Nul komma nul. Zelfs het scorebord schaamde zich om dit te tonen.",
  "Fietsbandjes uitgedeeld. Tijd voor een flinke portie zelfreflectie.",
  "Nul. Helemaal niks. Autsj.",
  "Een rondje nul. Bewaar 'm goed.",
  "Blank gehouden. Wreed maar mooi.",
  "Niet één gametje. Dat vergeet de groep nooit.",
  "6–0. De genadeloze klassieker.",
  "6–0. Zelfs de kantinejuffrouw vroeg of jullie eigenlijk wel meededen.",
  "Nul games. Dat is statistisch gezien bijna moeilijker dan één game winnen.",
  "Een bagel! Zelfs met een vijfvoudige tactische wissel was dit niet minder pijnlijk geweest.",
  "Helemaal van de kaart geveegd. Mijn aantekeningen over deze set passen gemakkelijk op een postzegel.",
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
] as const;

const KAMPIOEN_NEUTRAAL = [
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

/**
 * Coach Rudy's commentaar bij een feed-gebeurtenis, of null als hij zwijgt.
 * Pias-quips lopen via coachSneer (respecteert schild + intensiteit); de rest
 * kiest uit een vaste pool op de gebeurtenis-seed.
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
    case "pias-week":
      return coachSneer(
        roastCtx(
          { roast_intensiteit: ctx.intensiteitVoor(event.groupId) },
          ctx.profiles[event.playerId],
        ),
        roastSeed(event.playerId, event.weekStart),
        g,
      );
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
      if (h.some((x) => x.type === "streak" || x.type === "duo")) return kiesUniek(REEKS, seed, g);
      if (h.some((x) => x.type === "upset")) return kiesUniek(UPSET, seed, g);
      if (h.some((x) => x.type === "score" && x.label === "bagel")) {
        return kiesUniek(verliezersHebbenSchild(event, ctx) ? BAGEL_NEUTRAAL : BAGEL, seed, g);
      }
      if (h.some((x) => x.type === "score" && x.label === "monsterzege")) return kiesUniek(MONSTER, seed, g);
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
