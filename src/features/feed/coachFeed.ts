// Coach Rudy in de feed (#183): de commentator reageert op de sáppige
// gebeurtenissen — pias van de week/maand, kampioenen, promoties/degradaties en
// matches met een upset, bagel, monsterzege of winreeks. Mundane items (polls,
// vriendschappen, groepsnieuws) laat hij bewust links liggen, anders wordt de
// feed ruis. Alles deterministisch geseed zodat de hele groep dezelfde quip
// ziet; roast-quips respecteren de groepsintensiteit en het roast-schild.
// Pure functie, getest in coachFeed.test.ts.

import type { FeedEvent } from "../../lib/feed";
import type { Profile, RoastIntensiteit } from "../../lib/types";
import { coachSneer, roastCtx, roastSeed } from "../../lib/roastTone";

export interface CoachCtx {
  /** Roast-toon per groep. */
  intensiteitVoor: (groupId: string) => RoastIntensiteit;
  /** Profielen (voor het roast-schild van het doelwit). */
  profiles: Record<string, Profile>;
}

/** Stabiele keuze uit een pool op basis van de seed. */
function kies(pool: readonly string[], seed: number): string {
  return pool[((seed % pool.length) + pool.length) % pool.length];
}

// Niet-roast pools (hype/felicitatie/leedvermaak): niet door het schild
// beperkt, want het is commentaar op een gebeurtenis, geen persoonlijke sneer.
const KAMPIOEN = [
  "Kampioen. Geniet ervan — het duurt nooit lang.",
  "De beker is voor jou. Volgend seizoen pak ik 'm terug, zeggen de rest.",
  "Applaus. Verdiend. Voor nu.",
] as const;

const PROMOTIE = [
  "Omhoog! Maar hoogmoed komt vlak vóór de degradatie.",
  "Een divisie hoger. Adem de ijle lucht op, het went snel.",
  "Stijgen is makkelijk. Blijven is de kunst.",
] as const;

const DEGRADATIE = [
  "Een divisie lager. De zwaartekracht wint altijd.",
  "Dalende lijn. Ik zou maar gaan trainen.",
  "Terug naar af. Gebeurt de besten. En jou dus ook.",
] as const;

const REEKS = [
  "Niet meer te stoppen, die. Voorlopig.",
  "Op dreef! Iemand moet er een stok tussen steken.",
  "Reeks na reeks. Geniet, tot de klap komt.",
] as const;

const UPSET = [
  "Daar gaan de favorieten. Héérlijk om te zien.",
  "Papieren favorieten, opgelet: het papier scheurt.",
  "De underdog bijt. Wie had dát gedacht.",
] as const;

const BAGEL = [
  "Een bagel. Nul games. Iemand mag zich diep schamen.",
  "6–0. Dat is geen wedstrijd, dat is een openbare terechtstelling.",
  "Broodje bagel geserveerd. Koud opgediend.",
] as const;

const MONSTER = [
  "Meedogenloos afgemaakt. Prachtig wreed.",
  "Dat was geen partij, dat was een statement.",
  "Genadeloos. De coach knikt goedkeurend.",
] as const;

/**
 * Coach Rudy's commentaar bij een feed-gebeurtenis, of null als hij zwijgt.
 * Pias-quips lopen via coachSneer (respecteert schild + intensiteit); de rest
 * kiest uit een vaste pool op de gebeurtenis-seed.
 */
export function coachOpmerking(event: FeedEvent, ctx: CoachCtx): string | null {
  switch (event.kind) {
    case "maand-pias":
      return coachSneer(
        roastCtx(
          { roast_intensiteit: ctx.intensiteitVoor(event.groupId) },
          ctx.profiles[event.playerId],
        ),
        roastSeed(event.playerId, event.periodeLabel),
      );
    case "pias-week":
      return coachSneer(
        roastCtx(
          { roast_intensiteit: ctx.intensiteitVoor(event.groupId) },
          ctx.profiles[event.playerId],
        ),
        roastSeed(event.playerId, event.weekStart),
      );
    case "zwarte-piet":
      return coachSneer(
        roastCtx(
          { roast_intensiteit: ctx.intensiteitVoor(event.groupId) },
          ctx.profiles[event.toPlayerId],
        ),
        roastSeed(event.toPlayerId, event.at),
      );
    case "season-champion":
      return kies(KAMPIOEN, roastSeed(event.playerId, event.seasonLabel));
    case "rank": {
      const omhoog =
        event.shift === "nieuw" ||
        (typeof event.shift === "number" && event.shift > 0);
      return kies(omhoog ? PROMOTIE : DEGRADATIE, roastSeed(event.playerId, event.at));
    }
    case "match": {
      const seed = roastSeed(event.match.id);
      const h = event.highlights;
      if (h.some((x) => x.type === "streak" || x.type === "duo")) return kies(REEKS, seed);
      if (h.some((x) => x.type === "upset")) return kies(UPSET, seed);
      if (h.some((x) => x.type === "score" && x.label === "bagel")) return kies(BAGEL, seed);
      if (h.some((x) => x.type === "score" && x.label === "monsterzege")) return kies(MONSTER, seed);
      return null; // gewone match: Coach Rudy zwijgt (anti-ruis)
    }
    default:
      return null;
  }
}
