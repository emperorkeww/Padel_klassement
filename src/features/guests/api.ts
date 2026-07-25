import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";

/**
 * Koppelverzoeken voor gastspelers (#681): de eigenaar van een gast vraagt aan
 * of een bestaand account die gast is; dat account bevestigt of weigert. Bij
 * bevestiging neemt het echte profiel alle historie over en verdwijnt de gast.
 *
 * Alle schrijfacties lopen via SECURITY DEFINER-RPC's — de tabel zelf is voor
 * de client alleen leesbaar, en RLS toont enkel je eigen verzoeken (als
 * aanvrager of als aangewezen speler).
 */
export interface GuestClaim {
  id: string;
  guest_id: string;
  player_id: string;
  requested_by: string;
  status: "pending" | "declined" | "cancelled";
  created_at: string;
  updated_at: string;
}

/** Mijn openstaande koppelverzoeken, beide richtingen (RLS filtert). */
export function getMyGuestClaims(): Promise<GuestClaim[]> {
  return cached("guestClaims:mine", async () => {
    const { data, error } = await supabase
      .from("guest_claims")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as GuestClaim[];
  });
}

/** Vraagt aan of `playerId` de persoon achter gast `guestId` is. Mag alleen de
 *  eigenaar van de gast, en alleen voor een vriend of groepsgenoot. */
export async function requestGuestClaim(
  guestId: string,
  playerId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("request_guest_claim", {
    p_guest_id: guestId,
    p_player_id: playerId,
  });
  if (error) throw error;
  invalidate("guestClaims");
  return data as string;
}

/** Wat de koppeling verzette — voedt de bevestigings-toast. */
export interface GuestClaimResult {
  matches: number;
  groepen: number;
}

/** Bevestigt het verzoek: de historie van de gast verhuist naar mijn account en
 *  het gastprofiel verdwijnt. Onomkeerbaar. */
export async function claimGuestPlayer(
  guestId: string,
  playerId: string,
): Promise<GuestClaimResult> {
  const { data, error } = await supabase.rpc("claim_guest_player", {
    p_guest_id: guestId,
    p_player_id: playerId,
  });
  if (error) throw error;
  // De gast bestaat niet meer, de matches hangen aan andere teams en de ratings
  // zijn volledig herberekend: zowat elke gecachte lijst is nu verouderd.
  invalidate(
    "guestClaims",
    "profiles",
    "matches",
    "teams",
    "standings",
    "ratings",
    "groups",
    "friendships",
    "vendettas",
    "pias",
    "shame",
    "dictator",
  );
  return (data ?? { matches: 0, groepen: 0 }) as unknown as GuestClaimResult;
}

/** Weigeren (door de aangewezen speler) of intrekken (door de aanvrager). */
export async function cancelGuestClaim(claimId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_guest_claim", {
    p_claim_id: claimId,
  });
  if (error) throw error;
  invalidate("guestClaims");
}
