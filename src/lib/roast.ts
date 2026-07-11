// Trash-talk-generator (#167): één rake, feitelijk kloppende observatie over de
// speler, puur afgeleid uit de al geladen matches (+ optioneel rating voor de
// divisie). Deterministisch geseed op het speler-id zodat de groep dezelfde
// roast ziet. Geen echte beledigingen — plagen, geen kwetsen. Null als er niets
// te roasten valt (te weinig matches of gewoon goed bezig).

import type { Match, PlayerRating, Team } from "./types";
import { inTeam, lossStreak, outcomeFor, winRate } from "./results";
import { tierFor } from "./tiers";

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
    uit.push(`Verloor ${s.verliesreeks}× op rij — het loopt echt niet lekker. 😬`);
  }
  if (s.winrate != null && s.winrate < 35) {
    uit.push(`${s.winrate}% winst. Statistiek liegt niet. 📉`);
  }
  if (s.bagelsGeslikt >= 1) {
    uit.push(
      s.bagelsGeslikt === 1
        ? "Slikte al eens een bagel 🥯 — nul games, autsj."
        : `Slikte al ${s.bagelsGeslikt} bagels 🥯. Verzamelaar?`,
    );
  }
  if (s.grootsteAframing >= 6) {
    uit.push(`Ooit met ${s.grootsteAframing} games verschil de vernieling in gedraaid. 🚑`);
  }
  if (s.divisie) {
    uit.push(`Zit nog altijd in divisie ${s.divisie}. Promotie? Ooit. 🐢`);
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
