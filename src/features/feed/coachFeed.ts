// Coach Rudy in de feed (#183): de commentator reageert op de sáppige
// gebeurtenissen — pias van de week/maand, kampioenen, promoties/degradaties en
// matches met een upset, bagel, monsterzege of winreeks. Mundane items (polls,
// vriendschappen, groepsnieuws) laat hij bewust links liggen, anders wordt de
// feed ruis. Alles deterministisch geseed zodat de hele groep dezelfde quip
// ziet; roast-quips respecteren de groepsintensiteit en het roast-schild.
// Pure functie, getest in coachFeed.test.ts.

import type { FeedEvent } from "../../lib/feed";
import type { Profile, RoastIntensiteit } from "../../lib/types";
import { coachSneer, kiesUniek, roastCtx, roastSeed } from "../../lib/roastTone";

export interface CoachCtx {
  /** Roast-toon per groep. */
  intensiteitVoor: (groupId: string) => RoastIntensiteit;
  /** Profielen (voor het roast-schild van het doelwit). */
  profiles: Record<string, Profile>;
  /** Al gebruikte quips binnen deze weergave; voorkomt dubbele lijnen in de
   *  zichtbare feed. Geef één gedeelde set mee aan alle items van één render. */
  gebruikt?: Set<string>;
}

// Niet-roast pools (hype/felicitatie/leedvermaak): niet door het schild
// beperkt, want het is commentaar op een gebeurtenis, geen persoonlijke sneer.
const KAMPIOEN = [
  "Kampioen. Geniet ervan — het duurt nooit lang.",
  "De beker is voor jou. De rest slijpt al de messen.",
  "Applaus. Verdiend. Voor nu.",
  "De troon is van jou. Tot iemand 'm afpakt.",
  "Kampioen! Zet 'm snel in de vitrine.",
  "Chapeau. Nu nog een keer, dan geloof ik het.",
  "De besten winnen. Vandaag was jij dat.",
  "Genieten van de top: mooi uitzicht, diepe val.",
] as const;

const PROMOTIE = [
  "Omhoog! Maar hoogmoed komt vlak vóór de degradatie.",
  "Een divisie hoger. Adem de ijle lucht in, het went snel.",
  "Stijgen is makkelijk. Blijven is de kunst.",
  "Promotie! Nu de verwachtingen nog waarmaken.",
  "Naar boven. Vergeet de onderburen niet.",
  "Netjes geklommen. Niet naar beneden kijken.",
  "Een trede hoger op de ladder. Hij wiebelt wel.",
  "Opgeklommen. De lucht daarboven is dun.",
] as const;

const DEGRADATIE = [
  "Een divisie lager. De zwaartekracht wint altijd.",
  "Dalende lijn. Ik zou maar gaan trainen.",
  "Terug naar af. Gebeurt de besten. En jou dus ook.",
  "Naar beneden. De vertrouwde bodem lonkt.",
  "Gedegradeerd. Warm maar op voor de terugkeer.",
  "Een trede lager. Het went vanzelf.",
  "Zakken gaat snel. Klimmen duurt eeuwen.",
  "Afgezakt. De onderbuurman heet nu 'jij'.",
] as const;

const REEKS = [
  "Niet meer te stoppen, die. Voorlopig.",
  "Op dreef! Iemand moet er een stok tussen steken.",
  "Reeks na reeks. Geniet, tot de klap komt.",
  "Losgeslagen. Iemand een emmer koud water?",
  "Winst op winst. Verslavend, hè.",
  "Onstuitbaar. Tot de statistiek terugslaat.",
  "De machine draait. Onderhoud niet vergeten.",
  "Reeks aan de gang. Geniet zolang het duurt.",
] as const;

const UPSET = [
  "Daar gaan de favorieten. Héérlijk om te zien.",
  "Papieren favorieten, opgelet: het papier scheurt.",
  "De underdog bijt. Wie had dát gedacht.",
  "Voorspelling de prullenbak in. Prachtig.",
  "De outsider slaat toe. Kassa.",
  "Zoveel voor de papieren vorm.",
  "David 1, Goliath 0. Klassieker.",
  "De favoriet struikelt over z'n eigen ego.",
] as const;

const BAGEL = [
  "Een bagel. Nul games. Iemand mag zich diep schamen.",
  "6–0. Dat is geen wedstrijd, dat is een openbare terechtstelling.",
  "Broodje bagel geserveerd. Koud opgediend.",
  "Nul. Helemaal niks. Autsj.",
  "Een rondje nul. Bewaar 'm goed.",
  "Blank gehouden. Wreed maar mooi.",
  "Niet één gametje. Dat vergeet de groep nooit.",
  "6–0. De genadeloze klassieker.",
] as const;

const MONSTER = [
  "Meedogenloos afgemaakt. Prachtig wreed.",
  "Dat was geen partij, dat was een statement.",
  "Genadeloos. De coach knikt goedkeurend.",
  "Weggespeeld. Zonder pardon.",
  "Een pak slaag om in te lijsten.",
  "Deed pijn om te zien. Op de goede manier.",
  "Compleet ingemaakt. Zo hoort dat.",
  "De sloophamer erin. Effectief.",
] as const;

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
      return kiesUniek(KAMPIOEN, roastSeed(event.playerId, event.seasonLabel), g);
    case "rank": {
      const omhoog =
        event.shift === "nieuw" ||
        (typeof event.shift === "number" && event.shift > 0);
      return kiesUniek(omhoog ? PROMOTIE : DEGRADATIE, roastSeed(event.playerId, event.at), g);
    }
    case "match": {
      const seed = roastSeed(event.match.id);
      const h = event.highlights;
      if (h.some((x) => x.type === "streak" || x.type === "duo")) return kiesUniek(REEKS, seed, g);
      if (h.some((x) => x.type === "upset")) return kiesUniek(UPSET, seed, g);
      if (h.some((x) => x.type === "score" && x.label === "bagel")) return kiesUniek(BAGEL, seed, g);
      if (h.some((x) => x.type === "score" && x.label === "monsterzege")) return kiesUniek(MONSTER, seed, g);
      return null; // gewone match: Coach Rudy zwijgt (anti-ruis)
    }
    default:
      return null;
  }
}
