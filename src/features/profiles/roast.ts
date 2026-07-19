// Trash-talk-generator (#167): één rake, feitelijk kloppende observatie over de
// speler, puur afgeleid uit de al geladen matches (+ optioneel rating voor de
// divisie). Deterministisch geseed op het speler-id zodat de groep dezelfde
// roast ziet. Geen echte beledigingen — plagen, geen kwetsen. Null als er niets
// te roasten valt (te weinig matches of gewoon goed bezig).

import type { Match, PlayerRating, Team } from "@/types";
import { inTeam, lossStreak, outcomeFor, winRate } from "@/features/rating/results";
import { tierFor } from "@/features/rating/tiers";

/** Minimum aantal matches voordat we iemand roasten (anders niet eerlijk). */
export const ROAST_MIN_MATCHES = 8;

interface Signalen {
  gespeeld: number;
  winrate: number | null; // 0..100
  verliesreeks: number; // huidige
  bagelsGeslikt: number; // verloren met 0 games
  grootsteAframing: number; // grootste verliesmarge
  divisie: string | null; // huidige tier-label
}

function signalenVoor(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  rating: number | null,
): Signalen {
  let gespeeld = 0;
  let gewonnen = 0;
  let bagelsGeslikt = 0;
  let grootsteAframing = 0;
  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    gespeeld++;
    if (o === "W") gewonnen++;
    if (o === "L" && m.score_a != null && m.score_b != null) {
      const inA = inTeam(teams[m.team_a_id], playerId);
      const mij = inA ? m.score_a : m.score_b;
      const hen = inA ? m.score_b : m.score_a;
      grootsteAframing = Math.max(grootsteAframing, hen - mij);
      if (mij === 0 && hen > 0) bagelsGeslikt++;
    }
  }
  return {
    gespeeld,
    winrate: winRate(gewonnen, gespeeld),
    verliesreeks: lossStreak(matches, teams, playerId),
    bagelsGeslikt,
    grootsteAframing,
    divisie: rating != null ? (tierFor(rating)?.label ?? null) : null,
  };
}

/** Kandidaat-roasts; alleen wie z'n voorwaarde haalt doet mee. */
function kandidaten(s: Signalen): string[] {
  const uit: string[] = [];
  if (s.verliesreeks >= 3) {
    uit.push(`Verloor nu al ${s.verliesreeks}× op rij. Misschien je racket toch maar huren in plaats van kopen? 😬`);
    uit.push(`Staat momenteel op een verliesreeks van ${s.verliesreeks} matches. Ik zou m'n spiekbriefjes en tactiekborden maar ritueel verbranden.`);
    uit.push(`Nu al ${s.verliesreeks} nederlagen op rij. Zelfs de Belgische pers zou me ontslaan als ik jou nu nog opstel.`);
  }
  if (s.winrate != null && s.winrate < 35) {
    uit.push(`Met een winrate van ${s.winrate}% speel je vooral voor de gezelligheid, toch? 📉`);
    uit.push(`Een winrate van maar ${s.winrate}%... Zelfs Napoli onder mijn leiding toonde meer tactische bezieling.`);
    uit.push(`Met een dramatisch winstpercentage van ${s.winrate}% is het een wonder dat je racket nog niet bij het grofvuil ligt.`);
  }
  if (s.bagelsGeslikt >= 1) {
    uit.push(
      s.bagelsGeslikt === 1
        ? "Slikte al eens een bagel 🥯 — hopelijk smaakte die nul een beetje."
        : `Slikte al ${s.bagelsGeslikt} bagels 🥯. Spaart waarschijnlijk voor een eigen bakkerij.`,
    );
    if (s.bagelsGeslikt >= 1) {
      uit.push(`Heeft al ${s.bagelsGeslikt} bagels op de teller staan. Dat is geen padelcarrière, dat is een uitgebreid ontbijtbuffet.`);
    }
  }
  if (s.grootsteAframing >= 6) {
    uit.push(`Ooit met ${s.grootsteAframing} games verschil afgedroogd. Zelfs de ramen van de kooi waren beslagen. 🚑`);
    uit.push(`Met maar liefst ${s.grootsteAframing} games verschil om de oren gekregen. Mijn kletsnatte pak zat vandaag strakker in elkaar dan die verdediging.`);
    uit.push(`Een afstraffing van ${s.grootsteAframing} games verschil. Zelfs een trauma-helikopter had deze tactische moderamp niet kunnen redden.`);
  }
  if (s.divisie) {
    uit.push(`Hummelt nog steeds rond in divisie ${s.divisie}. Promotie is blijkbaar een vijfjarenplan. 🐢`);
    uit.push(`Hangt nog steeds vast in divisie ${s.divisie}. Zelfs Gianni Infantino kan deze prestaties niet corrupt genoeg herberekenen voor promotie.`);
    uit.push(`Slijt zijn dagen in divisie ${s.divisie}. Je hanteert je racket blijkbaar nog steeds als een hete pan mosselen.`);
  }
  return uit;
}

/**
 * Eén ludieke roast voor de speler, of null. `seed` (bv. hash van het
 * speler-id) kiest deterministisch welke van de passende observaties komt.
 */
export function roast(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  seed: number,
  ratings?: Record<string, PlayerRating>,
): string | null {
  const rating = ratings?.[playerId]?.rating ?? null;
  const s = signalenVoor(matches, teams, playerId, rating);
  if (s.gespeeld < ROAST_MIN_MATCHES) return null;
  const opties = kandidaten(s);
  if (opties.length === 0) return null;
  const i = ((seed % opties.length) + opties.length) % opties.length;
  return opties[i];
}
