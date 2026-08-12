import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { getMyGroups } from "@/features/groups/api";
import { getPlayerMatches } from "@/features/matches/api";
import { loadOpenPolls } from "@/features/dashboard/dashboardHelpers";
import { agendaAttentie, spelenAttentie } from "./attentie";

/**
 * De attentiestippen van de vaste navigatie (#1214).
 *
 * Geen eigen bronnen: alle drie de queries zijn dezelfde gecachete sleutels die
 * het overzicht, de hub en de agenda toch al gebruiken (queryCache, 30 s). Wie
 * op Overzicht binnenkomt betaalt hier dus niets extra; wie op Klassement
 * binnenkomt haalt ze een ronde eerder op dan anders.
 *
 * Niet-blokkerend, met opzet: zolang er niets binnen is staat er geen stip. Een
 * balk die op data wacht is erger dan een stip die een seconde later verschijnt
 * — daarom ook geen skeletons of laadstaten hier.
 */
export function useAttentie(myId: string): { agenda: boolean; spelen: boolean } {
  const groepen = useAsync(
    () => (myId ? getMyGroups() : Promise.resolve([])),
    [myId],
  );
  const groepSleutel = (groepen.data ?? []).map((g) => g.id).join(",");
  // Op de sleutel van de groepenlijst en niet op de lijst zelf: die is elke
  // render een nieuwe array, en dan zou dit blijven herladen.
  const bundels = useAsync(() => loadOpenPolls(groepen.data ?? []), [
    groepSleutel,
  ]);
  const matches = useAsync(
    () => (myId ? getPlayerMatches(myId, 100) : Promise.resolve([])),
    [myId],
  );

  // Een stem van iemand anders verandert niets aan jóuw stip, maar je eigen
  // stem wél — en die kan van een ander tabblad of vanaf de stemkaart komen.
  // Zelfde reden voor de matches: de uitslag die jij net invulde hoort de stip
  // te doven zonder refresh.
  useRealtime("play_polls", bundels.reload);
  useRealtime("play_poll_votes", bundels.reload);
  useRealtime("matches", matches.reload);

  const nu = Date.now();
  return {
    agenda: agendaAttentie(bundels.data ?? [], myId, nu),
    spelen: spelenAttentie(matches.data ?? [], nu),
  };
}

export default useAttentie;
