import { supabase } from "../../lib/supabase";
import type { Group, GroupMember } from "../../lib/types";

/** Groepen waar de gebruiker lid van is (RLS filtert). */
export async function getMyGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getGroup(id: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []) as GroupMember[];
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
}

/** Genereert een Americano-ronde via de RPC; geeft de nieuwe match-ids terug. */
export async function generateAmericanoRound(
  groupId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("generate_americano_round", {
    p_group_id: groupId,
  });
  if (error) throw error;
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
  return (data as string[]) ?? [];
}
