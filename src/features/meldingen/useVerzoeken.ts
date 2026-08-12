import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { getMyFriendships, categorize } from "@/features/friends/api";

/**
 * Hoeveel vriendschapsverzoeken er op jou staan te wachten (#1232).
 *
 * De meldingenrij die send-push bij zo'n verzoek schrijft is *gelezen*-
 * gebaseerd: klap je hem één keer open, dan is het signaal weg terwijl het
 * verzoek nog gewoon openstaat. Sinds het overzicht zijn pillenstrook kwijt is
 * (#1232) was dat het enige signaal, dus telt de shell nu de toestand zelf:
 * pending vriendschappen waarin ik de geadresseerde ben.
 *
 * Geen eigen bron: "friendships:mine" is de gecachete sleutel (queryCache, 30 s)
 * die het overzicht en de vriendenpagina toch al gebruiken. Niet-blokkerend —
 * zolang er niets binnen is, is het antwoord 0 en staat er geen stip. Zelfde
 * afspraak als useAttentie (#1214).
 */
export function useVerzoeken(myId: string): number {
  const friendships = useAsync(
    () => (myId ? getMyFriendships() : Promise.resolve([])),
    [myId],
  );
  // Accepteer je een verzoek in een ander tabblad of op de vriendenpagina, dan
  // hoort de stip te doven zonder refresh.
  useRealtime("friendships", friendships.reload);

  return categorize(friendships.data ?? [], myId).incoming.length;
}

export default useVerzoeken;
