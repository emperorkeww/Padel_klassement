import { useCallback, useEffect, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { tierChange } from "@/features/rating/tiers";
import { coachTierQuip } from "@/features/coach/coachMoments";
import type { PackData } from "./components/PackOpening";
import { getRatingHistory } from "./ratingsApi";

// Promotie/degradatie-aankondiging (#127). Client-side gedetecteerd uit de
// eigen rating-historie: het realtime matches-event komt ná de DB-trigger
// (zelfde transactie), dus de reload ziet het nieuwe punt — óók wanneer
// iemand anders de uitslag invoerde. Bij het opslaan zelf is de nieuwe rating
// nog niet bekend; daarom hangt dit hier en niet in de uitslag-flow.
// Sinds #500 is een promotie geen toast meer maar een pack-opening: de hook
// levert de PackData en de layout rendert het PackOpening-overlay.

const flagKey = (userId: string) => `tier-announced:${userId}`;

function readFlag(userId: string): string | null {
  try {
    return window.localStorage.getItem(flagKey(userId));
  } catch {
    return null; // private mode
  }
}

function writeFlag(userId: string, matchId: string) {
  try {
    window.localStorage.setItem(flagKey(userId), matchId);
  } catch {
    // localStorage onbeschikbaar: dan hooguit een dubbele toast, geen ramp.
  }
}

/** Meldt de eigen tier-wissel zodra een nieuwe uitslag de rating over een
 *  drempel tilt: een hoofdtier-promotie als pack-opening (#500), een
 *  degradatie als toast. Eén mount app-breed; de caller rendert
 *  `<PackOpening pack={pack} onClose={sluitPack} …/>`.
 *  `schild` is het eigen roast-schild: aan → een zachtere/neutrale Rudy-tekst. */
export function useTierAnnouncement(myId: string, schild = false) {
  const history = useAsync(
    () => (myId ? getRatingHistory(myId) : Promise.resolve([])),
    [myId],
  );
  useRealtime("matches", history.reload);
  const toast = useToast();
  const [pack, setPack] = useState<PackData | null>(null);

  useEffect(() => {
    const points = history.data;
    if (!myId || !points?.length) return;
    const latest = points[points.length - 1];
    const last = readFlag(myId);
    if (last === latest.match_id) return; // al aangekondigd
    writeFlag(myId, latest.match_id);
    if (last === null) return; // eerste bezoek: alleen seeden, geen historie

    // Vergelijk met de rating ná de laatst-aangekondigde match als die nog in
    // de historie zit: een avond met meerdere matches telt zo als één netto
    // wissel, en dit overleeft een herbouw van de historie.
    const prevIdx = points.findIndex((p) => p.match_id === last);
    const before =
      prevIdx >= 0 ? points[prevIdx].rating_after : latest.rating_before;
    const wissel = tierChange(before, latest.rating_after);
    if (!wissel) return;
    // Alleen echte divisiewissels (#299): een sub-niveau-stapje (III→II) blijft
    // stil. Tiers zijn globaal (geen groep), dus intensiteit valt op de default;
    // het eigen roast-schild wordt wél gerespecteerd.
    if (!wissel.hoofdtier) return;
    const zin = coachTierQuip({
      richting: wissel.richting,
      tierLabel: wissel.naar.label,
      naarKey: wissel.naar.key,
      seed: `${myId}-${latest.match_id}`,
      ctx: { intensiteit: "gemeen", schild },
    });
    if (wissel.richting === "promotie") {
      // Pack-opening (#500): confetti en haptiek vuren pas op het moment dat
      // de gebruiker het pack openscheurt, in de component zelf.
      setPack({
        soort: "promotie",
        wissel,
        rating: latest.rating_after,
        quip: zin,
      });
    } else {
      toast.info(zin);
    }
  }, [history.data, myId, schild, toast]);

  const sluitPack = useCallback(() => setPack(null), []);
  return { pack, sluitPack };
}
