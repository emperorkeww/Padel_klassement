import { supabase } from "../../lib/supabase";
import type { PlayerRating, RatingPoint } from "../../lib/types";

/** Huidige rating per speler, als lookup-map op player_id. */
export async function getPlayerRatings(): Promise<Record<string, PlayerRating>> {
  const { data, error } = await supabase.from("player_ratings").select("*");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.player_id, r]));
}

/** Rating-historie van één speler, chronologisch (oud → nieuw) voor de grafiek. */
export async function getRatingHistory(
  playerId: string,
): Promise<RatingPoint[]> {
  const { data, error } = await supabase
    .from("rating_history")
    .select("match_id, rating_before, rating_after, delta, played_at")
    .eq("player_id", playerId)
    .order("played_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RatingPoint[];
}
