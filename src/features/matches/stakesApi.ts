import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { TablesInsert } from "@/lib/supabase/database.types";
import type { MatchStake } from "@/features/matches/stakes";

// Lef-tip (#804): inzetten op geplande groepsmatches. Zelfde cache/RLS-patroon
// als predictionsApi. play_date is een serverside kolom: de guard-trigger leidt
// de speeldag af uit de starttijd van de match en die kolom draagt het tegoed
// (één inzet per speeldag) — de client schrijft alleen de sleutel.

/** Alle inzetten op één match (RLS: alleen groepen waar je lid van bent). */
export function getMatchStakes(matchId: string): Promise<MatchStake[]> {
  return cached(`match-stakes:match:${matchId}`, async () => {
    const { data, error } = await supabase
      .from("match_stakes")
      .select("*")
      .eq("match_id", matchId);
    if (error) throw error;
    return data ?? [];
  });
}

/**
 * Je eigen inzetten op één speeldag — genoeg om het tegoed te tonen zonder de
 * hele historie op te halen. Meer dan één rij kan het per definitie niet zijn.
 */
export function getMyStakesOn(
  playerId: string,
  day: string,
): Promise<MatchStake[]> {
  return cached(`match-stakes:day:${playerId}:${day}`, async () => {
    const { data, error } = await supabase
      .from("match_stakes")
      .select("*")
      .eq("player_id", playerId)
      .eq("play_date", day);
    if (error) throw error;
    return data ?? [];
  });
}

/** Zet je lef in op je eigen match; kan tot de starttijd. */
export async function setStake(input: {
  matchId: string;
  groupId: string;
  playerId: string;
}): Promise<void> {
  const { error } = await supabase.from("match_stakes").insert(
    // play_date is in de Insert-types verplicht (not null zonder default), maar
    // de kolomgrants verbieden de client die aan te leveren: de guard-trigger
    // leidt hem af uit de match. Vandaar de smalle cast, zoals bij de toto.
    {
      match_id: input.matchId,
      group_id: input.groupId,
      player_id: input.playerId,
    } as TablesInsert<"match_stakes">,
  );
  if (error) throw error;
  invalidate("match-stakes");
}

/** Trekt je inzet weer in (kan tot de starttijd). */
export async function clearStake(
  matchId: string,
  playerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("match_stakes")
    .delete()
    .eq("match_id", matchId)
    .eq("player_id", playerId);
  if (error) throw error;
  invalidate("match-stakes");
}
