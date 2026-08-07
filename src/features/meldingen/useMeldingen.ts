import { useCallback, useMemo } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useCacheRevision } from "@/lib/hooks/useCacheRevision";
import { useRealtime } from "@/lib/hooks/useRealtime";
import {
  getMeldingen,
  getOngelezenAantal,
  type Melding,
  PANEEL_LIMIET,
} from "./api";

/**
 * De meldingen van de ingelogde speler, live (#1090).
 *
 * Eén hook voor de hele shell: de bel in de topbalk, de zijbalkregel op desktop
 * en het paneel lezen allemaal hetzelfde. Daarom hangt hij in DashboardLayout
 * en niet in de knop zelf — anders telden twee ingangen apart en zouden ze uit
 * de pas kunnen lopen.
 *
 * De realtime-filter op user_id is geen beveiliging (RLS doet dat al) maar
 * scheelt wakkerworden: zonder filter tikt elke melding van elke speler dit
 * abonnement aan. Deletes dragen alleen de primary key en vallen dus buiten de
 * filter — hier onschadelijk, want meldingen verdwijnen alleen door de
 * 90-dagen-opruiming en dan valt er niets te tonen dat er al niet stond.
 */
export function useMeldingen(myId: string) {
  const rev = useCacheRevision("meldingen");
  const lijst = useAsync<Melding[]>(
    () => (myId ? getMeldingen() : Promise.resolve([])),
    [myId, rev],
  );
  const ongelezen = useAsync<number>(
    () => (myId ? getOngelezenAantal() : Promise.resolve(0)),
    [myId, rev],
  );

  const filter = useMemo(
    () => (myId ? `user_id=eq.${myId}` : undefined),
    [myId],
  );
  // useRealtime invalideert de cache al vóór deze callback; het herladen is
  // wat de twee useAsync's opnieuw laat lopen. De twee reload-functies zijn
  // stabiel (useCallback met lege deps in useAsync), dus deze callback ook —
  // en dat is de voorwaarde waaronder useRealtime zijn kanaal niet elke render
  // opnieuw opzet.
  const herlaadLijst = lijst.reload;
  const herlaadAantal = ongelezen.reload;
  const herlaad = useCallback(() => {
    herlaadLijst();
    herlaadAantal();
  }, [herlaadLijst, herlaadAantal]);
  useRealtime("notifications", herlaad, filter);

  return {
    meldingen: lijst.data ?? [],
    /** Null zolang het aantal nog niet bekend is: dan toont de bel géén 0-badge
     *  die meteen daarna naar 3 springt. */
    ongelezen: ongelezen.data ?? null,
    laadt: lijst.loading,
    fout: lijst.error,
    limiet: PANEEL_LIMIET,
    herlaad,
  };
}
