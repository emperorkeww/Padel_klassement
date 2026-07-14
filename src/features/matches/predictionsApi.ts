import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { MatchPrediction, PredictionStanding } from "../../lib/predictions";

// Toto (#116): tips op geplande groepsmatches. Losse typering (tabel-shim)
// tot database.types.ts opnieuw gegenereerd wordt; zelfde cache/RLS-patroon
// als pollsApi. win_chance en points zijn serverside kolommen: de guard-
// trigger bevriest de winkans bij het tippen en de grading-trigger kent de
// punten toe — de client schrijft alleen de tip zelf.

type Err = { message: string } | null;
type SelectQuery<Row> = {
  eq: (c: string, v: string) => SelectQuery<Row>;
  order: (c: string, opts?: { ascending?: boolean }) => SelectQuery<Row>;
} & Promise<{ data: Row[] | null; error: Err }>;
type DeleteQuery = {
  eq: (c: string, v: string) => DeleteQuery;
} & Promise<{ error: Err }>;
type Table<Row> = {
  select: (cols: string) => SelectQuery<Row>;
  delete: () => DeleteQuery;
  upsert: (
    values: Record<string, unknown>,
    opts: { onConflict: string },
  ) => Promise<{ error: Err }>;
};
const predictionTable = () =>
  supabase.from("match_predictions" as never) as unknown as Table<MatchPrediction>;
const standingsView = () =>
  supabase.from("group_prediction_standings" as never) as unknown as Table<
    PredictionStanding & { group_id: string }
  >;

/** Alle tips van een groep (RLS: alleen eigen groepen). */
export function getGroupPredictions(
  groupId: string,
): Promise<MatchPrediction[]> {
  return cached(`match-predictions:group:${groupId}`, async () => {
    const { data, error } = await predictionTable()
      .select("*")
      .eq("group_id", groupId);
    if (error) throw error;
    return data ?? [];
  });
}

/** Alle tips op één match. */
export function getMatchPredictions(
  matchId: string,
): Promise<MatchPrediction[]> {
  return cached(`match-predictions:match:${matchId}`, async () => {
    const { data, error } = await predictionTable()
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
  const { error } = await predictionTable().upsert(
    {
      match_id: input.matchId,
      group_id: input.groupId,
      player_id: input.playerId,
      predicted_team_id: input.predictedTeamId,
    },
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
  const { error } = await predictionTable()
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
    const { data, error } = await standingsView()
      .select("player_id, username, full_name, predicted, correct, points")
      .eq("group_id", groupId)
      .order("points", { ascending: false })
      .order("correct", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}
