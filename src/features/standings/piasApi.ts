import { supabase } from "@/lib/supabase/client";
import { cached } from "@/lib/supabase/queryCache";
import type { PiasWeek } from "../../lib/pias";

// Pias van de week (#127): de serverside aangeduide pias per groep, per
// ISO-week (tabel public.pias_of_week, gevuld door recompute_pias). Losse
// typering (tabel-shim) tot database.types.ts opnieuw gegenereerd wordt;
// zelfde cache/RLS-patroon als predictionsApi. De tabel is read-only voor de
// client — enkel de SECURITY DEFINER-trigger schrijft erin.

type Err = { message: string } | null;
type SelectQuery<Row> = {
  order: (c: string, opts?: { ascending?: boolean }) => SelectQuery<Row>;
} & Promise<{ data: Row[] | null; error: Err }>;
type Table<Row> = { select: (cols: string) => SelectQuery<Row> };

interface PiasRow {
  group_id: string;
  iso_year: number;
  iso_week: number;
  player_id: string;
  match_id: string;
  win_chance: number;
  week_start: string;
}

const piasTable = () =>
  supabase.from("pias_of_week" as never) as unknown as Table<PiasRow>;

const toPiasWeek = (r: PiasRow): PiasWeek => ({
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
    const { data, error } = await piasTable()
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
