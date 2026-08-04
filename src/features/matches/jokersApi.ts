import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { jokerFoutMelding, type JokerId, type MatchJoker } from "@/features/matches/jokers";

// Jokers (#1003): één kaart per speler per kalendermaand, gespeeld op geplande
// groepsmatches. Zelfde cache/RLS-patroon als stakesApi. period_month is een
// serverside kolom: de guard-trigger leidt de maand af uit de starttijd van de
// match en die kolom draagt het tegoed — de client schrijft alleen de sleutel
// en de gekozen kaart.

/** Alle jokers op één match (RLS: alleen groepen waar je lid van bent). */
export function getMatchJokers(matchId: string): Promise<MatchJoker[]> {
  return cached(`match-jokers:match:${matchId}`, async () => {
    const { data, error } = await supabase
      .from("match_jokers")
      .select("*")
      .eq("match_id", matchId);
    if (error) throw error;
    return (data ?? []) as MatchJoker[];
  });
}

/** Meer id's per .in()-query en de URL wordt onhandig lang; dan liever twee. */
const BULK_CHUNK = 100;

/**
 * Jokers op een lijst matches tegelijk: één query voor een hele rondelijst of
 * historie, zodat niet elke ingeklapte kaart zijn eigen fetch doet. De sleutel
 * sorteert de id's zodat dezelfde lijst in een andere volgorde dezelfde cache
 * raakt — zelfde constructie als getStakesForMatches.
 */
export function getJokersForMatches(matchIds: string[]): Promise<MatchJoker[]> {
  if (matchIds.length === 0) return Promise.resolve([]);
  const ids = [...new Set(matchIds)].sort();
  return cached(`match-jokers:bulk:${ids.join(",")}`, async () => {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += BULK_CHUNK)
      chunks.push(ids.slice(i, i + BULK_CHUNK));
    const delen = await Promise.all(
      chunks.map(async (chunk) => {
        const { data, error } = await supabase
          .from("match_jokers")
          .select("*")
          .in("match_id", chunk);
        if (error) throw error;
        return (data ?? []) as MatchJoker[];
      }),
    );
    return delen.flat();
  });
}

/**
 * Je eigen kaart van één kalendermaand — genoeg om het tegoed te tonen zonder
 * de hele historie op te halen. Meer dan één rij kan het per definitie niet
 * zijn: de unieke index match_jokers_one_per_month staat dat niet toe.
 */
export function getMyJokerInMonth(
  playerId: string,
  month: string,
): Promise<MatchJoker[]> {
  return cached(`match-jokers:maand:${playerId}:${month}`, async () => {
    const { data, error } = await supabase
      .from("match_jokers")
      .select("*")
      .eq("player_id", playerId)
      .eq("period_month", month);
    if (error) throw error;
    return (data ?? []) as MatchJoker[];
  });
}

/** Speel je kaart uit op je eigen match; kan tot de starttijd. */
export async function setJoker(input: {
  matchId: string;
  groupId: string;
  playerId: string;
  joker: JokerId;
}): Promise<void> {
  const { error } = await supabase.from("match_jokers").insert(
    // period_month is in de Insert-types verplicht (not null zonder default),
    // maar de kolomgrants verbieden de client die aan te leveren: de
    // guard-trigger leidt hem af uit de match. Vandaar de smalle cast, zoals
    // bij de lef-tip en de toto.
    {
      match_id: input.matchId,
      group_id: input.groupId,
      player_id: input.playerId,
      joker: input.joker,
    } as TablesInsert<"match_jokers">,
  );
  // Ook ná een fout: botst de insert op het maandtegoed, dan klopte het beeld
  // dat de client had niet meer. Die cache moet hoe dan ook weg, anders blijft
  // de tegel een kaart aanbieden die allang gespeeld is.
  invalidate("match-jokers");
  if (error) throw new Error(jokerFoutMelding(error));
}

/** Trekt je kaart weer in (kan tot de starttijd). */
export async function clearJoker(
  matchId: string,
  playerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("match_jokers")
    .delete()
    .eq("match_id", matchId)
    .eq("player_id", playerId);
  // Zelfde reden als bij setJoker: ook een mislukte intrekking betekent dat het
  // beeld van de client niet meer te vertrouwen is. De invalidatie laat élke
  // jokertegel opnieuw ophalen, niet alleen die van deze match.
  invalidate("match-jokers");
  if (error) throw error;
}
