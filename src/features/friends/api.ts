import { supabase } from "../../lib/supabase";
import { cached, invalidate } from "../../lib/queryCache";
import type { Friendship, FriendshipStatus } from "../../lib/types";

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

/** Categoriseert vriendschappen t.o.v. de huidige gebruiker. */
export function categorize(list: Friendship[], myId: string) {
  const accepted = list.filter((f) => f.status === "accepted");
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
