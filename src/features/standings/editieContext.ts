import { getAllRatingHistories, getPlayerRatings } from "./ratingsApi";
import { getHuidigeDictator } from "./dictatorApi";
import { getPlayerStandings } from "./api";
import { getSeizoenskampioen } from "./kampioen";
import { getGlobalePias } from "./piasApi";
import { getGlobaleZwartePiet } from "@/features/groups/zwartePietApi";
import { spelerVanDeWeek } from "./spelerVanDeWeek";
import { currentPias } from "./pias";
import { onFireSpelers } from "./onFire";
import { iconKeyVoor, type EditieContext } from "./edities";

// De EditieContext op één plek laden (#675). Leaderboard, MatchDetail en
// PlayerProfile stellen 'm ieder met de hand samen uit zeven useAsync-hooks —
// prima zolang je een scherm rendert, maar de deel-poster heeft 'm pas nodig
// op het moment dat iemand op "Afbeelding" tikt. Dan wil je één await, geen
// zeven hooks die de Plannen-tab bij élke render laten fetchen.
//
// Alle bronnen zitten achter `cached()`, dus dit is meestal gratis: wat het
// scherm al ophaalde wordt hier hergebruikt.

/**
 * Bouwt de EditieContext op uit de app-brede (gecachete) bronnen. Dezelfde
 * samenstelling als Leaderboard/MatchDetail/PlayerProfile, zodat een speler
 * op de poster exact de kaart draagt die hij in de app heeft.
 */
export async function laadEditieContext(): Promise<EditieContext> {
  const [histories, ratings, dictator, standings, kampioen, pias, piet] =
    await Promise.all([
      getAllRatingHistories(),
      getPlayerRatings(),
      getHuidigeDictator(),
      getPlayerStandings(),
      getSeizoenskampioen(),
      getGlobalePias(),
      getGlobaleZwartePiet(),
    ]);
  const dictatorId = dictator?.profileId ?? null;
  return {
    dictatorId,
    iconKey: iconKeyVoor(standings, ratings, dictatorId),
    kampioen: kampioen ?? null,
    inForm: spelerVanDeWeek(histories),
    onFire: onFireSpelers(histories),
    pias: currentPias(pias),
    piet: piet ?? null,
  };
}
