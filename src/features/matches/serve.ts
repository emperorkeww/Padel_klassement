import { roastSeed } from "@/features/coach/roastTone";
import type { Match } from "@/types";

/** Welk team de eerste opslag heeft (#435). Deterministisch afgeleid uit
 *  `match.id`, zodat iedereen in de groep zonder muntje dezelfde uitkomst
 *  ziet. Bewust niet geseed op team-ids: teams worden gededupliceerd
 *  (`teams_unique_pair`), dus hetzelfde koppel zou anders elke ronde opnieuw
 *  de opslag krijgen. */
export function serveerTeam(match: Pick<Match, "id">): "a" | "b" {
  // roastSeed is signed 32-bit en kan dus negatief zijn; de even-check blijft
  // dan correct (-3 % 2 === -1, -4 % 2 === 0). Niet herschrijven naar === 1.
  return roastSeed(match.id) % 2 === 0 ? "a" : "b";
}
