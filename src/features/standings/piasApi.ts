import { supabase } from "@/lib/supabase/client";
import { cached } from "@/lib/supabase/queryCache";
import type { Tables } from "@/lib/supabase/database.types";
import type { PiasWeek } from "@/features/standings/pias";

// Pias van de week (#127): de serverside aangeduide pias per groep, per
// ISO-week (tabel public.pias_of_week, gevuld door recompute_pias). Zelfde
// cache/RLS-patroon als predictionsApi. De tabel is read-only voor de
// client — enkel de SECURITY DEFINER-trigger schrijft erin.

const toPiasWeek = (r: Tables<"pias_of_week">): PiasWeek => ({
  groupId: r.group_id,
  isoYear: r.iso_year,
  isoWeek: r.iso_week,
  playerId: r.player_id,
  matchId: r.match_id,
  winChance: Number(r.win_chance),
  weekStart: r.week_start,
});

/** Alle aangeduide piassen in mijn groepen (RLS: alleen eigen groepen),
 *  gegroepeerd per groep en nieuwste week eerst. */
export function getPiasWeeks(): Promise<Record<string, PiasWeek[]>> {
  return cached("pias:all", async () => {
    const { data, error } = await supabase
      .from("pias_of_week")
      .select("*")
      .order("week_start", { ascending: false });
    if (error) throw error;
    const byGroup: Record<string, PiasWeek[]> = {};
    for (const row of data ?? []) {
      const pias = toPiasWeek(row);
      (byGroup[pias.groupId] ??= []).push(pias);
    }
    return byGroup;
  });
}
