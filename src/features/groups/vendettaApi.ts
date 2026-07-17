import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { Tables } from "@/lib/supabase/database.types";

// Vendetta's (#169): het contract van een verklaarde aartsrivaliteit tussen
// twee groepsgenoten. Zelfde cache/RLS-patroon als smoesjesApi/zwartePietApi.
// RLS beperkt select tot de eigen groepen; de guard-trigger borgt dat de
// rivaal groepslid is en dat beëindigen éénmalig is. De tussenstand staat
// bewust niet in de DB — die leidt vendetta.ts af uit de onderlinge matches.

/** Eén vendetta-contract (tabelrij public.vendettas). */
export type Vendetta = Tables<"vendettas">;

/** Alle vendetta's van één groep, nieuwste eerst. */
export function getGroupVendettas(groupId: string): Promise<Vendetta[]> {
  return cached(`vendettas:group:${groupId}`, async () => {
    const { data, error } = await supabase
      .from("vendettas")
      .select("*")
      .eq("group_id", groupId)
      .order("started_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

/** Alle vendetta's in je groepen (RLS: alleen eigen groepen) — voedt de feed. */
export function getMyVendettas(): Promise<Vendetta[]> {
  return cached("vendettas:all", async () => {
    const { data, error } = await supabase
      .from("vendettas")
      .select("*")
      .order("started_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
}

/** Actieve vendetta's waar een speler bij betrokken is (profielbadge ⚔️). */
export function getPlayerVendettas(playerId: string): Promise<Vendetta[]> {
  return cached(`vendettas:player:${playerId}`, async () => {
    const { data, error } = await supabase
      .from("vendettas")
      .select("*")
      .eq("status", "active")
      .or(`challenger_id.eq.${playerId},rival_id.eq.${playerId}`);
    if (error) throw error;
    return data ?? [];
  });
}

/** Verklaart een vendetta tegen een groepsgenoot. De unieke index weigert een
 *  tweede actieve vendetta voor hetzelfde paar (ongeacht de richting). */
export async function startVendetta(input: {
  groupId: string;
  challengerId: string;
  rivalId: string;
  targetWins: 3 | 5 | 7;
}): Promise<void> {
  const { error } = await supabase.from("vendettas").insert({
    group_id: input.groupId,
    challenger_id: input.challengerId,
    rival_id: input.rivalId,
    target_wins: input.targetWins,
  });
  if (error) throw error;
  invalidate("vendettas");
}

/** Beëindigt een vendetta (kan alleen als betrokkene; ended_at zet de guard). */
export async function endVendetta(id: string): Promise<void> {
  const { error } = await supabase
    .from("vendettas")
    .update({ status: "ended" })
    .eq("id", id);
  if (error) throw error;
  invalidate("vendettas");
}
