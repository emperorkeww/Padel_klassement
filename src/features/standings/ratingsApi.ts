import { supabase } from "@/lib/supabase/client";
import { cached } from "@/lib/supabase/queryCache";
import { warnIfTruncated } from "@/lib/supabase/truncation";
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

/** Punten per speler in de gedeelde historie (#731). Bij ~4 matches per week
 *  is dat ruim een maand — genoeg voor de sparkline, de In-Form-week en een
 *  On-Fire-reeks. De payload schaalt hiermee met het aantal SPELERS in plaats
 *  van met het aantal matches; spelers × dit getal moet onder `max_rows`
 *  blijven (de RPC klemt zelf op 50 per speler). */
export const RECENT_HISTORY_LIMIT = 20;

/** Groepeert history-rijen per speler, chronologisch (oud → nieuw). */
function groupByPlayer(
  rows: (RatingPoint & { player_id: string })[],
): Record<string, RatingPoint[]> {
  const byPlayer: Record<string, RatingPoint[]> = {};
  for (const row of rows) {
    const { player_id, ...point } = row;
    (byPlayer[player_id] ??= []).push(point);
  }
  for (const punten of Object.values(byPlayer))
    punten.sort((a, b) => a.played_at.localeCompare(b.played_at));
  return byPlayer;
}

/** De recente rating-historie van álle spelers, per speler chronologisch
 *  (oud → nieuw) — voor de sparklines, de rangpijltjes en de edities.
 *
 *  Ging via een select op de hele tabel, die PostgREST stil afkapte op
 *  `max_rows` (#731): oplopend gesorteerd hield je dan de OUDSTE 1000 rijen
 *  over, dus bevroren sparklines zonder ook maar een error. Nu een RPC met een
 *  venster per speler, zodat de payload met het aantal spelers meegroeit en
 *  niet met het aantal matches.
 *
 *  Let op: dit venster is per speler. Wie de punten van een specifieke (mogelijk
 *  oudere) match nodig heeft — upsets, de pias-choke — gebruikt
 *  `getRatingHistoriesForMatches` en voegt beide samen. */
export function getRecentRatingHistories(): Promise<
  Record<string, RatingPoint[]>
> {
  return cached("ratings:history:recent", async () => {
    const { data, error } = await supabase.rpc("recent_rating_history", {
      p_limit: RECENT_HISTORY_LIMIT,
    });
    if (error) throw error;
    const rows = warnIfTruncated(data ?? [], "recent_rating_history");
    return groupByPlayer(rows);
  });
}

/** Hoeveel match-id's per query; ruim onder `max_rows` (≥4 rijen per match) en
 *  onder de URL-lengte die PostgREST accepteert. */
const MATCH_CHUNK = 100;

/** De rating-punten van specifieke matches, per speler gegroepeerd — dezelfde
 *  vorm als `getRecentRatingHistories`, zodat een scherm ze kan samenvoegen.
 *
 *  Voor upsets (#85) en de pias-choke heb je de échte pre-match ratings van
 *  precies de getoonde matches nodig, ook als die ouder zijn dan het gedeelde
 *  venster. Begrensd door het aantal matches dat het scherm toont; per blok
 *  gecachet zodat schermen met overlappende lijsten elkaars werk hergebruiken. */
export function getRatingHistoriesForMatches(
  matchIds: string[],
): Promise<Record<string, RatingPoint[]>> {
  const wanted = [...new Set(matchIds)].sort();
  if (wanted.length === 0) return Promise.resolve({});
  const chunks: string[][] = [];
  for (let i = 0; i < wanted.length; i += MATCH_CHUNK)
    chunks.push(wanted.slice(i, i + MATCH_CHUNK));
  return Promise.all(chunks.map((ids) => fetchMatchHistories(ids))).then(
    (delen) => mergeRatingHistories(...delen),
  );
}

function fetchMatchHistories(
  ids: string[],
): Promise<Record<string, RatingPoint[]>> {
  return cached(`ratings:history:matches:${ids.join(",")}`, async () => {
    const { data, error } = await supabase
      .from("rating_history")
      .select("player_id, match_id, rating_before, rating_after, delta, played_at")
      .in("match_id", ids);
    if (error) throw error;
    const rows = warnIfTruncated(
      (data ?? []) as (RatingPoint & { player_id: string })[],
      "rating_history (per match)",
    );
    return groupByPlayer(rows);
  });
}

/** Voegt historie-records samen tot één record, per speler chronologisch.
 *  Punten die in meerdere bronnen zitten tellen één keer — anders zou
 *  spelerVanDeWeek dezelfde match dubbel optellen. */
export function mergeRatingHistories(
  ...records: Record<string, RatingPoint[]>[]
): Record<string, RatingPoint[]> {
  const rows: (RatingPoint & { player_id: string })[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    for (const [player_id, points] of Object.entries(record)) {
      for (const p of points) {
        // Eén speler kan legitiem twee rijen per match hebben (in beide teams),
        // dus de sleutel is meer dan alleen speler + match.
        const key = `${player_id}|${p.match_id}|${p.rating_before}|${p.delta}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ player_id, ...p });
      }
    }
  }
  return groupByPlayer(rows);
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

/** Rating per speler zoals die was aan het eind van `isoDate` (YYYY-MM-DD) —
 *  voor de tijdmachine ("stand op datum") in het klassement.
 *
 *  Vroeger uit de volledige historie geplukt; dat kan niet meer nu de gedeelde
 *  historie een venster is (#731), en het hoeft ook niet: de server geeft één
 *  rij per speler. Spelers zonder match t/m die dag ontbreken. */
export function getRatingsAsOf(isoDate: string): Promise<Record<string, number>> {
  return cached(`ratings:asof:${isoDate}`, async () => {
    const { data, error } = await supabase.rpc("ratings_as_of", {
      p_date: isoDate,
    });
    if (error) throw error;
    const rows = warnIfTruncated(data ?? [], "ratings_as_of");
    return Object.fromEntries(rows.map((r) => [r.player_id, r.rating]));
  });
}
