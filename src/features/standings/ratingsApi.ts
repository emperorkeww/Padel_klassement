import { supabase } from "../../lib/supabase";
import { cached } from "../../lib/queryCache";
import type { PlayerRating, RatingPoint } from "../../lib/types";

/** Huidige rating per speler, als lookup-map op player_id. */
export function getPlayerRatings(): Promise<Record<string, PlayerRating>> {
  return cached("ratings:all", async () => {
    const { data, error } = await supabase.from("player_ratings").select("*");
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((r) => [r.player_id, r]));
  });
}

// De grafiek toont hooguit een seizoen aan punten; oudere historie hoeft
// niet elke keer mee over de lijn.
const HISTORY_LIMIT = 100;

/** Rating-historie van één speler, chronologisch (oud → nieuw) voor de grafiek. */
export function getRatingHistory(playerId: string): Promise<RatingPoint[]> {
  return cached(`ratings:history:${playerId}`, async () => {
    const { data, error } = await supabase
      .from("rating_history")
      .select("match_id, rating_before, rating_after, delta, played_at")
      .eq("player_id", playerId)
      .order("played_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    if (error) throw error;
    // Nieuwste eerst opgehaald (voor de limiet), oudste eerst teruggeven.
    return ((data ?? []) as RatingPoint[]).reverse();
  });
}
