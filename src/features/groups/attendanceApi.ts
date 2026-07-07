import { supabase } from "../../lib/supabase";
import { cached, invalidate } from "../../lib/queryCache";

export type AttendanceStatus = "yes" | "no" | "maybe";
export type Attendance = {
  group_id: string;
  player_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  updated_at: string;
};

/** Aanwezigheid van één groep op één datum (RLS: alleen eigen groepen). */
export function getAttendance(
  groupId: string,
  date: string,
): Promise<Attendance[]> {
  return cached(`attendance:${groupId}:${date}`, async () => {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("group_id", groupId)
      .eq("date", date);
    if (error) throw error;
    return (data ?? []) as Attendance[];
  });
}

/** Zet (of wijzigt) je eigen status voor een speeldag. */
export async function setAttendance(
  groupId: string,
  playerId: string,
  date: string,
  status: AttendanceStatus,
): Promise<void> {
  const { error } = await supabase.from("attendance").upsert(
    {
      group_id: groupId,
      player_id: playerId,
      date,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "group_id,date,player_id" },
  );
  if (error) throw error;
  invalidate("attendance");
}

/**
 * Stuurt via de edge function "remind-group" een push naar de groepsleden die
 * voor deze speeldag nog geen aanwezigheid opgaven. Geeft terug hoeveel leden
 * herinnerd zijn. Vereist een gedeployede edge function (zie het rapport).
 */
export async function remindGroup(
  groupId: string,
  date: string,
): Promise<number> {
  const { data, error } = await supabase.functions.invoke<{ reminded: number }>(
    "remind-group",
    { body: { group_id: groupId, date } },
  );
  if (error) throw error;
  return data?.reminded ?? 0;
}
