import { useEffect } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { celebrate } from "@/lib/utils/confetti";
import { winPulse } from "@/lib/utils/haptics";
import { tierChange } from "@/features/rating/tiers";
import { coachTierQuip } from "@/features/coach/coachMoments";
import { getRatingHistory } from "./ratingsApi";

// Promotie/degradatie-aankondiging (#127). Client-side gedetecteerd uit de
// eigen rating-historie: het realtime matches-event komt ná de DB-trigger
// (zelfde transactie), dus de reload ziet het nieuwe punt — óók wanneer
// iemand anders de uitslag invoerde. Bij het opslaan zelf is de nieuwe rating
// nog niet bekend; daarom hangt dit hier en niet in de uitslag-flow.

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

/** Meldt de eigen tier-wissel (toast; confetti bij hoofdtier-promotie) zodra
 *  een nieuwe uitslag de rating over een drempel tilt. Eén mount app-breed.
 *  `schild` is het eigen roast-schild: aan → een zachtere/neutrale Rudy-toast. */
export function useTierAnnouncement(myId: string, schild = false) {
  const history = useAsync(
    () => (myId ? getRatingHistory(myId) : Promise.resolve([])),
    [myId],
  );
  useRealtime("matches", history.reload);
  const toast = useToast();

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
      seed: `${myId}-${latest.match_id}`,
      ctx: { intensiteit: "gemeen", schild },
    });
    if (wissel.richting === "promotie") {
      toast.success(zin);
      celebrate();
      winPulse();
    } else {
      toast.info(zin);
    }
  }, [history.data, myId, schild, toast]);
}
