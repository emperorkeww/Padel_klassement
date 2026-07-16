import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { Tables } from "@/lib/supabase/database.types";

// Smoesjes (#296): de op verloren groepsmatches geplaatste excuses. Zelfde
// cache/RLS-patroon als predictionsApi/zwartePietApi. RLS beperkt select tot de
// eigen groepen, en de guard-trigger borgt dat je alleen een smoes plaatst op
// een match die je écht verloor — de client schrijft enkel de tekst.

/** Eén geplaatste smoes (tabelrij public.match_smoesjes). */
export type MatchSmoes = Tables<"match_smoesjes">;

/** Alle smoezen in je groepen (RLS: alleen eigen groepen) — voert de feed. */
export function getMySmoesjes(): Promise<MatchSmoes[]> {
  return cached("smoesjes:all", async () => {
    const { data, error } = await supabase.from("match_smoesjes").select("*");
    if (error) throw error;
    return data ?? [];
  });
}

/** Alle (zichtbare) smoezen op één match — de speler filtert de zijne eruit. */
export function getMatchSmoesjes(matchId: string): Promise<MatchSmoes[]> {
  return cached(`smoesjes:match:${matchId}`, async () => {
    const { data, error } = await supabase
      .from("match_smoesjes")
      .select("*")
      .eq("match_id", matchId);
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
  const { error } = await supabase.from("match_smoesjes").upsert(
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
  const { error } = await supabase
    .from("match_smoesjes")
    .delete()
    .eq("match_id", matchId)
    .eq("player_id", playerId);
  if (error) throw error;
  invalidate("smoesjes");
}
