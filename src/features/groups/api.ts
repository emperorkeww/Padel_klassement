import { supabase } from "../../lib/supabase";
import { cached, invalidate } from "../../lib/queryCache";
import type { Group, GroupMember } from "../../lib/types";

/** Groep + leden-ids, zodat het overzicht kan tonen wie erin zit. */
export interface GroupSummary extends Group {
  member_ids: string[];
}

/** Groepen waar de gebruiker lid van is (RLS filtert), met hun leden. */
export function getMyGroups(): Promise<GroupSummary[]> {
  return cached("groups:mine", async () => {
    const { data, error } = await supabase
      .from("groups")
      .select("*, group_members(player_id)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(({ group_members, ...g }) => ({
      ...g,
      member_ids: (group_members ?? []).map((m) => m.player_id),
    }));
  });
}

export function getGroup(id: string): Promise<Group | null> {
  return cached(`groups:one:${id}`, async () => {
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
}

export function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  return cached(`members:${groupId}`, async () => {
    const { data, error } = await supabase
      .from("group_members")
      .select("*")
      .eq("group_id", groupId);
    if (error) throw error;
    return (data ?? []) as GroupMember[];
  });
}

export async function createGroup(
  name: string,
  createdBy: string,
): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .insert({ name: name.trim(), created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  invalidate("groups");
  return data;
}

export async function addGroupMember(
  groupId: string,
  playerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, player_id: playerId });
  if (error) throw error;
  // Ook het groepenoverzicht toont leden, dus die cache moet mee.
  invalidate(`members:${groupId}`, "groups");
}

export async function removeGroupMember(
  groupId: string,
  playerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("player_id", playerId);
  if (error) throw error;
  invalidate(`members:${groupId}`, "groups");
}

/** Genereert een Americano-ronde via de RPC; geeft de nieuwe match-ids terug. */
export async function generateAmericanoRound(
  groupId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("generate_americano_round", {
    p_group_id: groupId,
  });
  if (error) throw error;
  // Nieuwe geplande matches + eventueel nieuwe teamparen.
  invalidate("matches", "teams");
  return (data as string[]) ?? [];
}

/**
 * Genereert een Mexicano-ronde: paart op de huidige stand (sterk met zwak).
 * De RPC blokkeert als de vorige ronde nog niet volledig is ingevuld.
 */
export async function generateMexicanoRound(
  groupId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("generate_mexicano_round", {
    p_group_id: groupId,
  });
  if (error) throw error;
  invalidate("matches", "teams");
  return (data as string[]) ?? [];
}
