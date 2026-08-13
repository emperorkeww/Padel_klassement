import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { Group, GroupMember, RoastIntensiteit } from "@/types";

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

/** Zet de roast-intensiteit van een groep (#183; alleen de eigenaar, RLS). */
export async function setRoastIntensiteit(
  groupId: string,
  intensiteit: RoastIntensiteit,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ roast_intensiteit: intensiteit })
    .eq("id", groupId);
  if (error) throw error;
  invalidate(`groups:one:${groupId}`, "groups");
}

/** Zet automatisch rondes klaarzetten aan of uit (#827; eigenaar-only, RLS). */
export async function setAutoRondes(
  groupId: string,
  aan: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ auto_rondes: aan })
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
  const { data, error } = await supabase.rpc("create_group_invite", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return data;
}

/** Status van een uitnodigingslink voor de ingelogde gebruiker (#923).
 *  `member` is een succespad, geen fout: die hoort gewoon de groep in. */
export type InviteStatus = "ok" | "expired" | "unknown" | "member";

/** Wat er achter een uitnodigingstoken zit, zonder al lid te worden.
 *  Buiten `status` is alles leeg bij een onbekend token. */
export interface InvitePreview {
  status: InviteStatus;
  group_id: string | null;
  group_name: string | null;
  member_count: number;
  member_ids: string[];
  inviter_id: string | null;
  expires_at: string | null;
}

const ONBEKENDE_UITNODIGING: InvitePreview = {
  status: "unknown",
  group_id: null,
  group_name: null,
  member_count: 0,
  member_ids: [],
  inviter_id: null,
  expires_at: null,
};

/** Bekijkt een uitnodiging vóór het inwisselen. Loopt via een SECURITY
 *  DEFINER-RPC: een niet-lid mag `groups` en `group_members` niet lezen (RLS),
 *  en juist die naam moet je zien vóór je op "Word lid" drukt (#923). */
export async function previewGroupInvite(
  token: string,
): Promise<InvitePreview> {
  const { data, error } = await supabase
    .rpc("group_invite_preview", { p_token: token })
    .maybeSingle();
  if (error) throw error;
  if (!data) return ONBEKENDE_UITNODIGING;
  return {
    status: (data.status ?? "unknown") as InviteStatus,
    group_id: data.group_id,
    group_name: data.group_name,
    member_count: data.member_count ?? 0,
    member_ids: data.member_ids ?? [],
    inviter_id: data.inviter_id,
    expires_at: data.expires_at,
  };
}

/** Wisselt een uitnodigingstoken in (auto-join); geeft het groep-id terug. */
export async function redeemGroupInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("redeem_group_invite", {
    p_token: token,
  });
  if (error) throw error;
  invalidate("groups");
  return data;
}

/** Eén baan uit een "Eerlijke teams"-voorstel: twee spelers per team. */
export interface FairCourt {
  teamA: [string, string];
  teamB: [string, string];
}

/**
 * Schrijft een "Eerlijke teams"-voorstel weg als geplande matches (één ronde).
 * Geeft de nieuwe match-ids terug. `playedAt` (ISO) is de starttijd van de
 * ronde (#827); zonder gelockte speeldag blijft die weg en heeft de match
 * geen tijdstip, zoals voorheen.
 */
export async function createFairRound(
  groupId: string,
  courts: FairCourt[],
  playedAt?: string | null,
): Promise<string[]> {
  const players = courts.flatMap((c) => [...c.teamA, ...c.teamB]);
  const { data, error } = await supabase.rpc("create_fair_round", {
    p_group_id: groupId,
    p_players: players,
    p_played_at: playedAt ?? undefined,
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
 *
 * `players` is wie er meespeelt (#1271). Laat je hem weg, dan deelt de RPC de
 * hele ledenlijst in — precies de fout die maakte dat wie afzegde toch op de
 * baan stond. Alleen de vólgorde komt uit de stand, niet uit deze lijst.
 */
export async function generateMexicanoRound(
  groupId: string,
  playedAt?: string | null,
  players?: string[] | null,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("generate_mexicano_round", {
    p_group_id: groupId,
    p_played_at: playedAt ?? undefined,
    p_players: players ?? undefined,
  });
  if (error) throw error;
  invalidate("matches", "teams");
  return (data as string[]) ?? [];
}
