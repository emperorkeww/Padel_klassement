import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { AanwezigKeuzes } from "@/features/groups/aanwezigOpslag";

/**
 * Aanwezigheid per speeldag-moment (#1271).
 *
 * De correcties op "Wie speelt er mee?" leefden in localStorage: een tweede
 * organisator zag ze niet, de speler die afzegde zag zichzelf gewoon in de
 * opstelling staan, en een apparaatwissel wiste de avond. Ze horen bij de
 * groep, dus staan ze nu in `play_poll_presence`.
 *
 * Wat er staat zijn de *afwijkingen* van de stemming, niet de hele lijst — zie
 * de tabelcomment. Een speler die je niet aanraakte heeft hier geen rij en
 * volgt gewoon de poll.
 */

/** Alle afwijkingen voor één moment. */
export function getAanwezigheid(optionId: string): Promise<AanwezigKeuzes> {
  return cached(`play-poll-presence:${optionId}`, async () => {
    const { data, error } = await supabase
      .from("play_poll_presence")
      .select("player_id, aanwezig")
      .eq("option_id", optionId);
    if (error) throw error;
    const uit: AanwezigKeuzes = {};
    for (const rij of data ?? []) uit[rij.player_id] = rij.aanwezig;
    return uit;
  });
}

/**
 * Eén speler aan- of afmelden — of terug naar wat de stemming zegt (`null`).
 *
 * Los van `zetAanwezigheid` hieronder, dat de hele set van de organisator
 * schrijft. Hier gaat het om één rij, en meestal om jezelf: "ik kan toch niet",
 * ná het vastleggen, wanneer stemmen niet meer kan.
 */
export async function zetMijnAanwezigheid(
  optionId: string,
  groupId: string,
  playerId: string,
  aanwezig: boolean | null,
): Promise<void> {
  if (aanwezig === null) {
    const { error } = await supabase
      .from("play_poll_presence")
      .delete()
      .eq("option_id", optionId)
      .eq("player_id", playerId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("play_poll_presence").upsert(
      {
        option_id: optionId,
        group_id: groupId,
        player_id: playerId,
        aanwezig,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "option_id,player_id" },
    );
    if (error) throw error;
  }
  invalidate("play-poll-presence");
}

/**
 * Zet de afwijkingen voor één moment op precies deze set.
 *
 * Twee stappen en geen transactie: een upsert van wat erin hoort, en een delete
 * van wat eruit moet. Dat laatste is geen detail — "terug naar wat de poll
 * zegt" is een eigen betekenis, en die druk je uit door de rij weg te halen en
 * niet door er `true` in te zetten. Zonder de delete zou een speler die je
 * eerst afmeldde en daarna weer aanzette voor altijd een handmatige ja houden,
 * ook als hij zijn stem intrekt.
 */
export async function zetAanwezigheid(
  optionId: string,
  groupId: string,
  keuzes: AanwezigKeuzes,
): Promise<void> {
  const rijen = Object.entries(keuzes).map(([player_id, aanwezig]) => ({
    option_id: optionId,
    group_id: groupId,
    player_id,
    aanwezig,
    updated_at: new Date().toISOString(),
  }));

  if (rijen.length > 0) {
    const { error } = await supabase
      .from("play_poll_presence")
      .upsert(rijen, { onConflict: "option_id,player_id" });
    if (error) throw error;
  }

  const houden = Object.keys(keuzes);
  let weg = supabase
    .from("play_poll_presence")
    .delete()
    .eq("option_id", optionId);
  if (houden.length > 0) weg = weg.not("player_id", "in", `(${houden.join(",")})`);
  const { error } = await weg;
  if (error) throw error;
  invalidate("play-poll-presence");
}
