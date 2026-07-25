// Deelknop van de medaille-uitreiking (#713): bouwt de gala-poster en zet hem
// via de bestaande sharePng-flow op het klembord / in de downloads. Zelfde
// vorm als ShareChampion, dus de Eregalerij heeft twee knoppen die zich
// identiek gedragen.

import { useMemo, useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { sharePng } from "@/lib/utils/shareImage";
import { awardPoster, drawAwardPoster } from "@/features/seizoen/awardPoster";
import type { Award } from "@/features/seizoen/awards";

const W = 1080;
const H = 1350;

export function ShareAwards({
  groepsnaam,
  seizoen,
  awards,
  naam,
}: {
  groepsnaam: string;
  /** Bv. "☀️ Zomer 2026". */
  seizoen: string;
  awards: Award[];
  naam: (playerId: string) => string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const poster = useMemo(
    () => awardPoster({ groepsnaam, seizoen, awards, naam }),
    // `naam` is een inline-resolver van de aanroeper; de inhoud hangt aan de
    // awards en de labels, dus die zijn de echte deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groepsnaam, seizoen, awards],
  );

  async function deel() {
    if (!poster) return;
    setBusy(true);
    try {
      const outcome = await sharePng((ctx) => drawAwardPoster(ctx, poster), {
        width: W,
        height: H,
        filename: "vamos-uitreiking.png",
        title: `Vamos! ${seizoen}`,
      });
      if (outcome === "clipboard") toast.success("Poster gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Poster gedownload.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!poster) return null;

  return (
    <button className="btn btn--sm" onClick={deel} disabled={busy}>
      {busy ? "Bezig…" : "↗ Deel de uitreiking"}
    </button>
  );
}

export default ShareAwards;
