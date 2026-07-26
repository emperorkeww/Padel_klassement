import { supabase } from "@/lib/supabase/client";
import { cached } from "@/lib/supabase/queryCache";
import { MAX_ROWS, warnIfTruncated } from "@/lib/supabase/truncation";
import type { PlayerRating, RatingPoint } from "@/types";

/** Huidige rating per speler, als lookup-map op player_id. */
export function getPlayerRatings(): Promise<Record<string, PlayerRating>> {
  return cached("ratings:all", async () => {
    const { data, error } = await supabase.from("player_ratings").select("*");
    if (error) throw error;
    const rows = warnIfTruncated(data ?? [], "player_ratings");
    return Object.fromEntries(rows.map((r) => [r.player_id, r]));
  });
}

// De grafiek toont hooguit een seizoen aan punten; oudere historie hoeft
// niet elke keer mee over de lijn.
const HISTORY_LIMIT = 100;

/** Harde grens op de gedeelde historie-query (#731). Gelijk aan `max_rows`:
 *  hoger vragen heeft geen zin, want PostgREST kapt daar sowieso af. */
const ALL_HISTORY_LIMIT = MAX_ROWS;

/** Rating-historie van álle spelers in één query, gegroepeerd per speler en
 *  chronologisch (oud → nieuw) — voor de sparklines in het klassement.
 *
 *  Nieuwste eerst opgehaald, met expliciete limiet (#731): rating_history
 *  groeit met ~4 rijen per match, dus deze query loopt vroeg of laat tegen
 *  `max_rows` aan. Oplopend gesorteerd leverde die afkapping stil de oudste
 *  1000 rijen op — bevroren sparklines, geen historie voor nieuwe spelers, en
 *  geen error. Aflopend verlies je in het slechtste geval oude punten in plaats
 *  van juist de recente. Wordt de limiet geraakt, dan waarschuwt de wachter. */
export function getAllRatingHistories(): Promise<Record<string, RatingPoint[]>> {
  return cached("ratings:history:all", async () => {
    const { data, error } = await supabase
      .from("rating_history")
      .select("player_id, match_id, rating_before, rating_after, delta, played_at")
      .order("played_at", { ascending: false })
      .limit(ALL_HISTORY_LIMIT);
    if (error) throw error;
    const rows = warnIfTruncated(
      (data ?? []) as (RatingPoint & { player_id: string })[],
      "rating_history (alle spelers)",
      ALL_HISTORY_LIMIT,
    );
    const byPlayer: Record<string, RatingPoint[]> = {};
    for (const row of rows) {
      const { player_id, ...point } = row;
      (byPlayer[player_id] ??= []).push(point);
    }
    // Nieuwste eerst opgehaald (voor de limiet), chronologisch teruggeven —
    // sparkline, ratingAsOf en de edities rekenen op oud → nieuw.
    for (const punten of Object.values(byPlayer)) punten.reverse();
    return byPlayer;
  });
}

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
    // Kopie i.p.v. in-place reverse: het resultaat niet muteren.
    return [...((data ?? []) as RatingPoint[])].reverse();
  });
}
