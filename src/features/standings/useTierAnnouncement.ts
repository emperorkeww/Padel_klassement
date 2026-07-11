import { useEffect } from "react";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { celebrate } from "../../lib/confetti";
import { winPulse } from "../../lib/haptics";
import { tierChange } from "../../lib/tiers";
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
 *  een nieuwe uitslag de rating over een drempel tilt. Eén mount app-breed. */
export function useTierAnnouncement(myId: string) {
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
    if (wissel.richting === "promotie") {
      toast.success(`🎉 Gepromoveerd naar ${wissel.naar.label}!`);
      if (wissel.hoofdtier) {
        celebrate();
        winPulse();
      }
    } else {
      toast.info(
        `Je zakt naar ${wissel.naar.label} — volgende match pak je hem terug.`,
      );
    }
  }, [history.data, myId, toast]);
}
