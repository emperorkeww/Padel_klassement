import { useEffect } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { celebrate } from "@/lib/utils/confetti";
import { winPulse } from "@/lib/utils/haptics";
import { getPlayerMatches, getTeamsMap } from "@/features/matches/api";
import { outcomeFor, winStreak, lossStreak } from "@/features/rating/results";
import {
  coachStreakQuip,
  STREAK_MIJLPALEN,
  type StreakMijlpaal,
} from "@/features/coach/coachMoments";

// Streak-mijlpaal-aankondiging (#300). Net als de tier-toast (#299) client-side
// gedetecteerd uit de eigen matchhistorie i.p.v. in de uitslag-flow: het
// realtime matches-event komt ná de DB-transactie, dus de reload ziet de nieuwe
// uitslag — óók wanneer iemand anders hem invoerde. Een reeks is globaal (over
// alle groepen), dus er is geen groepstoon; intensiteit valt op de default, het
// eigen roast-schild wordt wél gerespecteerd.

const flagKey = (userId: string) => `streak-announced:${userId}`;

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

const MIJLPALEN: readonly number[] = STREAK_MIJLPALEN;

/** Meldt een eigen winst-/verliesreeks-mijlpaal (3/5/10) zodra een nieuwe
 *  uitslag de reeks precies op een drempel brengt. Toast (confetti bij winst);
 *  gededupliceerd per match zodat niet elke match — alleen de drempel — meldt.
 *  Eén mount app-breed. `schild` is het eigen roast-schild: aan → een zachtere,
 *  neutrale toast bij een verliesreeks (winst blijft lof). */
export function useStreakAnnouncement(myId: string, schild = false) {
  const matches = useAsync(
    () => (myId ? getPlayerMatches(myId, 100) : Promise.resolve([])),
    [myId],
  );
  const teams = useAsync(getTeamsMap, []);
  useRealtime("matches", matches.reload);
  const toast = useToast();

  useEffect(() => {
    const list = matches.data;
    const tmap = teams.data;
    if (!myId || !list?.length || !tmap) return;

    // De recentste afgeronde match waarin ik meespeelde bepaalt de reeks én is
    // de dedup-sleutel (een geplande/andermans match telt niet mee).
    const latest = [...list]
      .sort((a, b) =>
        (b.played_at ?? b.created_at).localeCompare(a.played_at ?? a.created_at),
      )
      .find((m) => outcomeFor(m, tmap, myId) != null);
    if (!latest) return;

    const last = readFlag(myId);
    if (last === latest.id) return; // al beoordeeld
    writeFlag(myId, latest.id);
    if (last === null) return; // eerste bezoek: alleen seeden, geen historie

    // winStreak/lossStreak tellen vanaf de recentste uitslag; hooguit één is > 0
    // (de andere is 0), een gelijkspel breekt beide.
    const win = winStreak(list, tmap, myId);
    const loss = lossStreak(list, tmap, myId);
    const count = win > 0 ? win : loss;
    // Alleen op de drempel melden (#300): lengte 4, 6, 7… blijft stil. Bij
    // meerdere matches in één reload melden we de hoogst bereikte mijlpaal.
    if (!MIJLPALEN.includes(count)) return;

    const richting = win > 0 ? "winst" : "verlies";
    const zin = coachStreakQuip({
      richting,
      mijlpaal: count as StreakMijlpaal,
      seed: `${myId}-${latest.id}`,
      ctx: { intensiteit: "gemeen", schild },
    });
    if (richting === "winst") {
      toast.success(zin);
      celebrate();
      winPulse();
    } else {
      toast.info(zin);
    }
  }, [matches.data, teams.data, myId, schild, toast]);
}
