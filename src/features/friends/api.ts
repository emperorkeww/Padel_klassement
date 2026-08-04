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

/** Mijn relatie met één andere speler, met de rij erbij (om op te reageren). */
export type MijnRelatie =
  | { soort: "vrienden"; rij: Friendship }
  | { soort: "verzoek-verstuurd"; rij: Friendship }
  | { soort: "verzoek-ontvangen"; rij: Friendship }
  /** Ik was de ontvanger en heb geweigerd — heropenen mag. */
  | { soort: "geweigerd-door-mij"; rij: Friendship }
  /** Zij weigerden mijn verzoek — dat blijft staan. */
  | { soort: "geweigerd-door-hen"; rij: Friendship };

/**
 * Map van speler-id → mijn relatie met die speler.
 *
 * Sinds #326 levert getMyFriendships() ook geaccepteerde vriendschappen tussen
 * twee dérden (leesbaar zodra één van beiden in mijn netwerk zit — de feed
 * heeft dat nodig). Wie daarop "elke zichtbare rij gaat over mij" aanneemt,
 * ziet vreemden als "al gekoppeld" (#1013). Vandaar: alleen eigen betrokkenheid.
 */
export function mijnRelaties(
  list: Friendship[],
  myId: string,
): Map<string, MijnRelatie> {
  const map = new Map<string, MijnRelatie>();
  for (const rij of list) {
    const ikBenVerzoeker = rij.requester_id === myId;
    if (!ikBenVerzoeker && rij.addressee_id !== myId) continue;
    const soort: MijnRelatie["soort"] =
      rij.status === "accepted"
        ? "vrienden"
        : rij.status === "pending"
          ? ikBenVerzoeker
            ? "verzoek-verstuurd"
            : "verzoek-ontvangen"
          : ikBenVerzoeker
            ? "geweigerd-door-hen"
            : "geweigerd-door-mij";
    map.set(otherId(rij, myId), { soort, rij } as MijnRelatie);
  }
  return map;
}

/**
 * Heropent een verzoek dat ík geweigerd heb. De unique index
 * friendships_unique_pair laat geen tweede rij per paar toe, en de UPDATE-policy
 * hoort bij de addressee terwijl een nieuw verzoek van de requester moet komen.
 * Dus: oude rij weg, vers pending-verzoek erin. Beide stappen mogen onder de
 * bestaande policies ("Betrokkene kan vriendschap verwijderen" + "Verzoek sturen
 * als verzoeker"). Faalt de tweede stap, dan is er simpelweg geen relatie meer
 * en staat de knop weer op "Verzoek sturen".
 */
export async function reopenFriendRequest(
  rowId: string,
  myId: string,
  addresseeId: string,
): Promise<void> {
  await removeFriendship(rowId);
  await sendFriendRequest(myId, addresseeId);
}
