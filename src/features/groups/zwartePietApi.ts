import { supabase } from "@/lib/supabase/client";
import { cached } from "@/lib/supabase/queryCache";
import type { Tables } from "@/lib/supabase/database.types";
import type { ZwartePiet } from "@/features/groups/zwartePiet";

// De Zwarte Piet (#185): de serverside aangeduide drager per groep (tabel
// public.zwarte_piet, gevuld door recompute_zwarte_piet). Zelfde cache/
// RLS-patroon als piasApi. Read-only voor de client — enkel de trigger schrijft.

/** De drager van één groep, inclusief zijn groep-id (voor de feed). */
export interface ZwartePietHolder extends ZwartePiet {
  groupId: string;
}

const toHolder = (r: Tables<"zwarte_piet">): ZwartePietHolder => ({
  groupId: r.group_id,
  holderId: r.holder_id,
  fromId: r.from_id,
  // reden is in de DB text met een CHECK; hier smaller getypt als union.
  reden: r.reden as ZwartePiet["reden"],
  ernst: r.ernst,
  detail: r.detail,
  matchId: r.match_id,
  since: r.since,
});

/** De huidige Zwarte Piet-drager per groep (RLS: alleen eigen groepen). */
export function getZwartePiet(): Promise<Record<string, ZwartePietHolder>> {
  return cached("shame:all", async () => {
    const { data, error } = await supabase.from("zwarte_piet").select("*");
    if (error) throw error;
    const byGroup: Record<string, ZwartePietHolder> = {};
    for (const row of data ?? []) byGroup[row.group_id] = toHolder(row);
    return byGroup;
  });
}
