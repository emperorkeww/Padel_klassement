import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import type { Friendship, FriendshipStatus, Profile } from "@/types";

/**
 * Zoekt spelers op gebruikersnaam, maar toont alleen wie zich vindbaar heeft
 * gesteld (profiles.discoverable). Vervangt searchProfiles voor de vrienden-
 * flow, zodat de privacy-instelling gerespecteerd wordt. Default 'discoverable'
 * is true, dus voor bestaande gebruikers verandert er niets.
 */
export async function searchDiscoverableProfiles(
  query: string,
  excludeId: string,
): Promise<Profile[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", `%${q}%`)
    .neq("id", excludeId)
    .eq("discoverable", true)
    .order("username", { ascending: true })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

/** Alle vriendschappen waar de ingelogde gebruiker bij betrokken is (RLS filtert). */
export function getMyFriendships(): Promise<Friendship[]> {
  return cached("friendships:mine", async () => {
    const { data, error } = await supabase
      .from("friendships")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Friendship[];
  });
}

export async function sendFriendRequest(
  requesterId: string,
  addresseeId: string,
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId });
  if (error) throw error;
  invalidate("friendships");
}

export async function respondToRequest(
  id: string,
  status: Exclude<FriendshipStatus, "pending">,
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  invalidate("friendships");
}

export async function removeFriendship(id: string): Promise<void> {
  const { error } = await supabase.from("friendships").delete().eq("id", id);
  if (error) throw error;
  invalidate("friendships");
}

/** Een voorgestelde vriend: profiel-id + aantal gemeenschappelijke vrienden. */
export interface FriendSuggestion {
  id: string;
  mutual_count: number;
  /** Ids van de gemeenschappelijke vrienden (de UI toont hun namen). */
  mutual_ids: string[];
}

/**
 * Voorgestelde vrienden voor de ingelogde gebruiker. Mensen met gemeenschappelijke
 * vrienden staan bovenaan (op aantal), aangevuld met willekeurige spelers.
 * Draait server-side (RPC) omdat vrienden-van-vrienden buiten de eigen RLS-zichtbaarheid vallen.
 */
export function getFriendSuggestions(): Promise<FriendSuggestion[]> {
  return cached("friendships:suggestions", async () => {
    const { data, error } = await supabase.rpc("get_friend_suggestions", {
      p_limit: 12,
    });
    if (error) throw error;
    return (data ?? []) as FriendSuggestion[];
  });
}

/** Categoriseert vriendschappen t.o.v. de huidige gebruiker. */
export function categorize(list: Friendship[], myId: string) {
  // Sinds #138 zijn ook geaccepteerde vriendschappen van groepsgenoten
  // leesbaar (voor de feed); "mijn vrienden" blijft strikt eigen betrokkenheid.
  const accepted = list.filter(
    (f) =>
      f.status === "accepted" &&
      (f.requester_id === myId || f.addressee_id === myId),
  );
  const incoming = list.filter(
    (f) => f.status === "pending" && f.addressee_id === myId,
  );
  const outgoing = list.filter(
    (f) => f.status === "pending" && f.requester_id === myId,
  );
  return { accepted, incoming, outgoing };
}

/** De id van de "andere" persoon in een vriendschap. */
export function otherId(f: Friendship, myId: string): string {
  return f.requester_id === myId ? f.addressee_id : f.requester_id;
}
