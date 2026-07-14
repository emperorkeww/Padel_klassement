import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";

// Smoesjes (#296): de op verloren groepsmatches geplaatste excuses. Losse
// typering (tabel-shim) tot database.types.ts opnieuw gegenereerd wordt; zelfde
// cache/RLS-patroon als predictionsApi/zwartePietApi. RLS beperkt select tot de
// eigen groepen, en de guard-trigger borgt dat je alleen een smoes plaatst op
// een match die je écht verloor — de client schrijft enkel de tekst.

/** Eén geplaatste smoes (tabelrij public.match_smoesjes). */
export interface MatchSmoes {
  match_id: string;
  player_id: string;
  group_id: string;
  smoes: string;
  created_at: string;
  updated_at: string;
}

type Err = { message: string } | null;
type SelectQuery<Row> = {
  eq: (c: string, v: string) => SelectQuery<Row>;
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
const smoesTable = () =>
  supabase.from("match_smoesjes" as never) as unknown as Table<MatchSmoes>;

/** Alle smoezen in je groepen (RLS: alleen eigen groepen) — voert de feed. */
export function getMySmoesjes(): Promise<MatchSmoes[]> {
  return cached("smoesjes:all", async () => {
    const { data, error } = await smoesTable().select("*");
    if (error) throw error;
    return data ?? [];
  });
}

/** Alle (zichtbare) smoezen op één match — de speler filtert de zijne eruit. */
export function getMatchSmoesjes(matchId: string): Promise<MatchSmoes[]> {
  return cached(`smoesjes:match:${matchId}`, async () => {
    const { data, error } = await smoesTable().select("*").eq("match_id", matchId);
    if (error) throw error;
    return data ?? [];
  });
}

/** Plaatst (of vervangt) je eigen smoes: één per verloren groepsmatch. */
export async function placeSmoes(input: {
  matchId: string;
  groupId: string;
  playerId: string;
  smoes: string;
}): Promise<void> {
  const { error } = await smoesTable().upsert(
    {
      match_id: input.matchId,
      group_id: input.groupId,
      player_id: input.playerId,
      smoes: input.smoes,
    },
    { onConflict: "match_id,player_id" },
  );
  if (error) throw error;
  invalidate("smoesjes");
}

/** Verwijdert je eigen geplaatste smoes weer van de feed. */
export async function removeSmoes(
  matchId: string,
  playerId: string,
): Promise<void> {
  const { error } = await smoesTable()
    .delete()
    .eq("match_id", matchId)
    .eq("player_id", playerId);
  if (error) throw error;
  invalidate("smoesjes");
}
