import { supabase } from "../../lib/supabase";
import { cached, invalidate } from "../../lib/queryCache";
import type { Group, GroupMember } from "../../lib/types";

// database.types.ts kent de nieuwe RPC's (create_group_invite,
// redeem_group_invite, create_fair_round) nog niet — die wordt later opnieuw
// gegenereerd. Tot dan losjes typen zodat we database.types.ts niet aanraken.
type RpcResult<T> = { data: T | null; error: { message: string } | null };
function rpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  return (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<RpcResult<T>>
  )(fn, args);
}

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

/** Voegt meerdere vrienden in één keer toe aan de groep. */
export async function addGroupMembers(
  groupId: string,
  playerIds: string[],
): Promise<void> {
  if (playerIds.length === 0) return;
  const { error } = await supabase
    .from("group_members")
    .insert(playerIds.map((player_id) => ({ group_id: groupId, player_id })));
  if (error) throw error;
  invalidate(`members:${groupId}`, "groups");
}

/** Hernoemt een groep (alleen de eigenaar, afgedwongen door RLS). */
export async function renameGroup(
  groupId: string,
  name: string,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ name: name.trim() })
    .eq("id", groupId);
  if (error) throw error;
  invalidate(`groups:one:${groupId}`, "groups");
}

/** Verwijdert een groep volledig (alleen de eigenaar, afgedwongen door RLS). */
export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw error;
  invalidate("groups", `members:${groupId}`, `matches:group:${groupId}`);
}

/** Laat de gebruiker zelf de groep verlaten (RLS staat het eigen lidmaatschap toe). */
export async function leaveGroup(
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

/** Maakt (of hergebruikt) een deelbare uitnodigingslink en geeft het token terug. */
export async function createGroupInvite(groupId: string): Promise<string> {
  const { data, error } = await rpc<string>("create_group_invite", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return data as string;
}

/** Wisselt een uitnodigingstoken in (auto-join); geeft het groep-id terug. */
export async function redeemGroupInvite(token: string): Promise<string> {
  const { data, error } = await rpc<string>("redeem_group_invite", {
    p_token: token,
  });
  if (error) throw error;
  invalidate("groups");
  return data as string;
}

/** Eén baan uit een "Eerlijke teams"-voorstel: twee spelers per team. */
export interface FairCourt {
  teamA: [string, string];
  teamB: [string, string];
}

/**
 * Schrijft een "Eerlijke teams"-voorstel weg als geplande matches (één ronde).
 * Geeft de nieuwe match-ids terug.
 */
export async function createFairRound(
  groupId: string,
  courts: FairCourt[],
): Promise<string[]> {
  const players = courts.flatMap((c) => [...c.teamA, ...c.teamB]);
  const { data, error } = await rpc<string[]>("create_fair_round", {
    p_group_id: groupId,
    p_players: players,
  });
  if (error) throw error;
  invalidate("matches", "teams");
  return data ?? [];
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
