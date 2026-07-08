import { supabase } from "../../lib/supabase";
import { cached, invalidate } from "../../lib/queryCache";
import { addDays } from "../../lib/time";

// Slot-beschikbaarheid per groepslid (datum + "HH:MM" in clubtijd), de fijnere
// tegenhanger van attendanceApi. Voedt het "Plan samen"-raster dat de stemmen
// combineert met de vrije banen. Zelfde upsert/cache/RLS-patroon als attendance.

export type SlotStatus = "yes" | "no" | "maybe";
export type SlotVote = {
  group_id: string;
  player_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM" clubtijd
  status: SlotStatus;
  updated_at: string;
};

// De tabel slot_availability zit nog niet in de gegenereerde database.types.ts;
// we typen de query's hier losjes (zoals de rpc-wrapper in groups/api.ts), tot
// die opnieuw gegenereerd wordt. De builders zijn tegelijk chainable én awaitbaar.
type Err = { message: string } | null;
type SelectQuery = {
  eq: (c: string, v: string) => SelectQuery;
  gte: (c: string, v: string) => SelectQuery;
  lte: (c: string, v: string) => SelectQuery;
} & Promise<{ data: SlotVote[] | null; error: Err }>;
type DeleteQuery = {
  eq: (c: string, v: string) => DeleteQuery;
} & Promise<{ error: Err }>;
type SlotTable = {
  select: (cols: string) => SelectQuery;
  delete: () => DeleteQuery;
  upsert: (
    values: Record<string, unknown>,
    opts: { onConflict: string },
  ) => Promise<{ error: Err }>;
};
function slotTable(): SlotTable {
  return supabase.from("slot_availability" as never) as unknown as SlotTable;
}

/** Alle slot-stemmen van een groep voor een week (RLS: alleen eigen groepen). */
export function getGroupSlotVotes(
  groupId: string,
  fromDate: string,
  days = 7,
): Promise<SlotVote[]> {
  const to = addDays(fromDate, days - 1);
  return cached(`slot-availability:${groupId}:${fromDate}`, async () => {
    const { data, error } = await slotTable()
      .select("*")
      .eq("group_id", groupId)
      .gte("date", fromDate)
      .lte("date", to);
    if (error) throw error;
    return data ?? [];
  });
}

/** Zet (of wijzigt) je eigen status voor één tijdslot. */
export async function setSlotVote(
  groupId: string,
  playerId: string,
  date: string,
  startTime: string,
  status: SlotStatus,
): Promise<void> {
  const { error } = await slotTable().upsert(
    {
      group_id: groupId,
      player_id: playerId,
      date,
      start_time: startTime,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "group_id,player_id,date,start_time" },
  );
  if (error) throw error;
  invalidate("slot-availability");
}

/** Verwijdert je eigen stem voor één tijdslot ("Wissen"). */
export async function clearSlotVote(
  groupId: string,
  playerId: string,
  date: string,
  startTime: string,
): Promise<void> {
  const { error } = await slotTable()
    .delete()
    .eq("group_id", groupId)
    .eq("player_id", playerId)
    .eq("date", date)
    .eq("start_time", startTime);
  if (error) throw error;
  invalidate("slot-availability");
}
