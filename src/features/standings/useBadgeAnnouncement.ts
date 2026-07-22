import { useCallback, useEffect, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { getPlayerMatches, getTeamsMap } from "@/features/matches/api";
import { deriveBadges, ZELDZAME_BADGES } from "@/features/profiles/badges";
import { tierFor } from "@/features/rating/tiers";
import { coachBadgeQuip } from "@/features/coach/coachMoments";
import type { BadgePack } from "./components/PackOpening";
import { getPlayerRatings } from "./ratingsApi";

// Zeldzame-badge-aankondiging (#615). Net als de tier- en streak-hooks
// client-side gedetecteerd uit de eigen matchhistorie: het realtime
// matches-event komt ná de DB-transactie, dus de reload ziet de nieuwe
// uitslag — óók wanneer iemand anders hem invoerde. Badges bestaan alleen
// client-side (deriveBadges); "net behaald" is dus een diff tussen de vorige
// en de huidige set behaalde badge-ids, bewaard in localStorage.

const flagKey = (userId: string) => `badges-announced:${userId}`;

/** De eerder aangekondigde/geseede badge-ids; null = eerste bezoek (key
 *  afwezig of onleesbaar — dan seeden we opnieuw en vieren we niets). */
function readSet(userId: string): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(flagKey(userId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return null; // private mode of corrupte JSON
  }
}

function writeSet(userId: string, ids: ReadonlySet<string>) {
  try {
    window.localStorage.setItem(flagKey(userId), JSON.stringify([...ids]));
  } catch {
    // localStorage onbeschikbaar: dan hooguit een dubbele viering, geen ramp.
  }
}

/** Opent een paars pack zodra een nieuwe uitslag een curated zeldzame badge
 *  (ZELDZAME_BADGES) doet omslaan naar behaald. Eén mount app-breed; de caller
 *  rendert `<PackOpening pack={pack} onClose={sluitPack} …/>`.
 *  Dedup per badge-id in localStorage; het eerste bezoek seedt de volledige
 *  set zonder historie te vieren. `schild` is het eigen roast-schild. */
export function useBadgeAnnouncement(myId: string, schild = false) {
  // Zelfde venster als het profiel (de-facto "all-time", cache wordt gedeeld).
  const matches = useAsync(
    () => (myId ? getPlayerMatches(myId, 200) : Promise.resolve([])),
    [myId],
  );
  const teams = useAsync(getTeamsMap, []);
  const ratings = useAsync(getPlayerRatings, []);
  const reload = useCallback(() => {
    matches.reload();
    ratings.reload();
  }, [matches.reload, ratings.reload]);
  useRealtime("matches", reload);
  const [pack, setPack] = useState<BadgePack | null>(null);

  useEffect(() => {
    // Wachten op álle drie de datasets: een eerste run zonder ratings zou een
    // set zonder de rating-badges seeden, waarna de run mét ratings die als
    // "nieuw" zou vieren. Een lege matchlijst telt ook niet — vóór het
    // inloggen resolvet de matches-fetch naar [] en zou die lege set seeden,
    // waarna de echte historie als "nieuw" viert (zelfde guard als de
    // tier-/streak-hooks; zonder matches zijn er toch geen badges).
    if (!myId || !matches.data?.length || !teams.data || !ratings.data) return;
    const behaald = deriveBadges(matches.data, teams.data, myId, ratings.data)
      .filter((b) => b.behaald);
    const oud = readSet(myId);
    // Union, nooit krimpen: schuift een oude match uit het 200-venster en
    // raakt een badge daardoor "ontbehaald", dan mag hij later niet opnieuw
    // vieren. En álle ids erin, niet alleen de zeldzame: groeit de curated
    // lijst later, dan viert een lang geleden behaalde badge geen historie.
    writeSet(myId, new Set([...(oud ?? []), ...behaald.map((b) => b.id)]));
    if (oud === null) return; // eerste bezoek: alleen seeden, geen historie

    const nieuw = behaald.filter(
      (b) => ZELDZAME_BADGES.has(b.id) && !oud.has(b.id),
    );
    if (nieuw.length === 0) return;
    // Meerdere nieuwe zeldzame badges tegelijk: vier er één (de catalogus zet
    // de zwaarste achteraan); de rest staat al in de set en viert nooit alsnog.
    const badge = nieuw[nieuw.length - 1];
    const rating = ratings.data[myId]?.rating ?? null;
    setPack({
      soort: "badge",
      badge: { id: badge.id, naam: badge.naam, emoji: badge.emoji },
      rating,
      tier: tierFor(rating),
      quip: coachBadgeQuip({
        badge: `${badge.emoji} ${badge.naam}`,
        seed: `${myId}-${badge.id}`,
        ctx: { intensiteit: "gemeen", schild },
      }),
    });
  }, [matches.data, teams.data, ratings.data, myId, schild]);

  const sluitPack = useCallback(() => setPack(null), []);
  return { pack, sluitPack };
}
