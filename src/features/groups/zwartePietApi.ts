import { supabase } from "../../lib/supabase";
import { cached } from "../../lib/queryCache";
import type { ZwartePiet } from "../../lib/zwartePiet";

// De Zwarte Piet (#185): de serverside aangeduide drager per groep (tabel
// public.zwarte_piet, gevuld door recompute_zwarte_piet). Losse typering
// (tabel-shim) tot database.types.ts opnieuw gegenereerd wordt; zelfde cache/
// RLS-patroon als piasApi. Read-only voor de client — enkel de trigger schrijft.

type Err = { message: string } | null;
type Table<Row> = { select: (cols: string) => Promise<{ data: Row[] | null; error: Err }> };

interface PietRow {
  group_id: string;
  holder_id: string;
  from_id: string | null;
  reden: ZwartePiet["reden"];
  ernst: number;
  detail: string;
  match_id: string;
  since: string;
}

/** De drager van één groep, inclusief zijn groep-id (voor de feed). */
export interface ZwartePietHolder extends ZwartePiet {
  groupId: string;
}

const pietTable = () =>
  supabase.from("zwarte_piet" as never) as unknown as Table<PietRow>;

const toHolder = (r: PietRow): ZwartePietHolder => ({
  groupId: r.group_id,
  holderId: r.holder_id,
  fromId: r.from_id,
  reden: r.reden,
  ernst: r.ernst,
  detail: r.detail,
  matchId: r.match_id,
  since: r.since,
});

/** De huidige Zwarte Piet-drager per groep (RLS: alleen eigen groepen). */
export function getZwartePiet(): Promise<Record<string, ZwartePietHolder>> {
  return cached("shame:all", async () => {
    const { data, error } = await pietTable().select("*");
    if (error) throw error;
    const byGroup: Record<string, ZwartePietHolder> = {};
    for (const row of data ?? []) byGroup[row.group_id] = toHolder(row);
    return byGroup;
  });
}
