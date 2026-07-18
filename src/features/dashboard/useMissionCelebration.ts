import { useCallback, useEffect, useRef } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { celebrate } from "@/lib/utils/confetti";
import { winPulse } from "@/lib/utils/haptics";
import { getPlayerMatches, getTeamsMap } from "@/features/matches/api";
import { deriveMissions, weekIndex } from "./missions";

// Confetti bij het behalen van een weekmissie (#414). App-breed gemount, net
// als useTierAnnouncement: gevierd wordt enkel de líve overgang niet-behaald →
// behaald terwijl de app open is — dus op het moment dat de uitslag wordt
// opgeslagen (via het realtime matches-event, óók als iemand anders logde). De
// eerste snapshot na het laden wordt stil geseed, zodat inloggen of een
// passieve view nooit confetti geeft. Bewust géén localStorage: een onbruikbare
// opslag kan zo geen "altijd vieren bij elke login" veroorzaken.

interface Snapshot {
  userId: string;
  weekIdx: number;
  behaald: Set<string>;
}

/** Viert (confetti + haptische puls) zodra een weekmissie behaald raakt terwijl
 *  de app open is. Eén mount app-breed (DashboardLayout), zoals de tier-melding. */
export function useMissionCelebration(myId: string) {
  const { data: matchData, reload: reloadMatches } = useAsync(
    () => (myId ? getPlayerMatches(myId, 100) : Promise.resolve([])),
    [myId],
  );
  const { data: teamData, reload: reloadTeams } = useAsync(getTeamsMap, []);
  const reload = useCallback(() => {
    reloadMatches();
    reloadTeams();
  }, [reloadMatches, reloadTeams]);
  useRealtime("matches", reload);

  // Vorige behaald-set, in-memory. Geen persistentie nodig: we vieren alleen
  // overgangen die we live zien, niet wat al behaald was bij het openen.
  const snapRef = useRef<Snapshot | null>(null);

  useEffect(() => {
    if (!myId || !matchData || !teamData) return;
    const nu = new Date();
    const weekIdx = weekIndex(nu);
    const missies = deriveMissions(matchData, teamData, myId, nu);
    const behaald = new Set(
      missies.filter((m) => m.behaald).map((m) => m.id),
    );

    const prev = snapRef.current;
    snapRef.current = { userId: myId, weekIdx, behaald };

    // Eerste snapshot, of na een account-/weekwissel: stil seeden, niet vieren.
    if (!prev || prev.userId !== myId || prev.weekIdx !== weekIdx) return;

    // Eén salvo zodra minstens één missie nieuw behaald is sinds de vorige pass,
    // ook als er meerdere tegelijk binnenkomen na een realtime-refresh.
    const nieuw = [...behaald].some((id) => !prev.behaald.has(id));
    if (nieuw) {
      celebrate();
      winPulse();
    }
  }, [matchData, teamData, myId]);
}
