import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { TablesInsert } from "@/lib/supabase/database.types";
import type { MatchPrediction, PredictionStanding } from "@/features/matches/predictions";

// Toto (#116): tips op geplande groepsmatches. Zelfde cache/RLS-patroon
// als pollsApi. win_chance en points zijn serverside kolommen: de guard-
// trigger bevriest de winkans bij het tippen en de grading-trigger kent de
// punten toe — de client schrijft alleen de tip zelf.

/** Alle tips van een groep (RLS: alleen eigen groepen). */
export function getGroupPredictions(
  groupId: string,
): Promise<MatchPrediction[]> {
  return cached(`match-predictions:group:${groupId}`, async () => {
    const { data, error } = await supabase
      .from("match_predictions")
      .select("*")
      .eq("group_id", groupId);
    if (error) throw error;
    return data ?? [];
  });
}

/** Alle tips van één speler, over al zijn groepen (RLS: alleen groepen die je
 *  deelt). Voedt de Valse profeet-badge (#809). */
export function getPlayerPredictions(
  playerId: string,
): Promise<MatchPrediction[]> {
  return cached(`match-predictions:player:${playerId}`, async () => {
    const { data, error } = await supabase
      .from("match_predictions")
      .select("*")
      .eq("player_id", playerId);
    if (error) throw error;
    return data ?? [];
  });
}

/** Alle tips op één match. */
export function getMatchPredictions(
  matchId: string,
): Promise<MatchPrediction[]> {
  return cached(`match-predictions:match:${matchId}`, async () => {
    const { data, error } = await supabase
      .from("match_predictions")
      .select("*")
      .eq("match_id", matchId);
    if (error) throw error;
    return data ?? [];
  });
}

/** Zet (of wijzig) je eigen tip: één per match, tot de starttijd. */
export async function setPrediction(input: {
  matchId: string;
  groupId: string;
  playerId: string;
  predictedTeamId: string;
}): Promise<void> {
  const { error } = await supabase.from("match_predictions").upsert(
    // win_chance is in de Insert-types verplicht (not null zonder default),
    // maar de kolomgrants verbieden de client die aan te leveren: de
    // guard-trigger berekent en bevriest hem. Vandaar de smalle cast.
    {
      match_id: input.matchId,
      group_id: input.groupId,
      player_id: input.playerId,
      predicted_team_id: input.predictedTeamId,
    } as TablesInsert<"match_predictions">,
    { onConflict: "match_id,player_id" },
  );
  if (error) throw error;
  invalidate("match-predictions", "prediction-standings");
}

/** Trekt je eigen tip in (kan tot de starttijd). */
export async function clearPrediction(
  matchId: string,
  playerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("match_predictions")
    .delete()
    .eq("match_id", matchId)
    .eq("player_id", playerId);
  if (error) throw error;
  invalidate("match-predictions", "prediction-standings");
}

/** All-time voorspellersklassement van een groep (view). */
export function getGroupPredictionStandings(
  groupId: string,
): Promise<PredictionStanding[]> {
  return cached(`prediction-standings:${groupId}`, async () => {
    const { data, error } = await supabase
      .from("group_prediction_standings")
      .select("player_id, username, full_name, predicted, correct, points")
      .eq("group_id", groupId)
      .order("points", { ascending: false })
      .order("correct", { ascending: false });
    if (error) throw error;
    // De view-kolommen zijn in de gegenereerde types nullable (Postgres kan de
    // NOT NULL van een view niet afleiden); in de praktijk zijn ze gevuld.
    return (data ?? []) as PredictionStanding[];
  });
}
