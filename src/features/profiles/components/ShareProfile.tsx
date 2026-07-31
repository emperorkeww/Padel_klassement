import { useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { sharePng } from "@/lib/utils/shareImage";
import { laadAvatar } from "@/lib/utils/futKaartCanvas";
import {
  laadKaartMaster,
  masterVoor,
} from "@/features/rating/components/kaartMasters";
import {
  drawProfielPoster,
  POSTER_H,
  POSTER_W,
  type ProfileShareData,
} from "@/features/profiles/profielPoster";

// Deel-knop van de persoonlijke poster: laadt de profielfoto voor (het canvas
// tekent synchroon) en geeft de tekening aan sharePng — zelfde deel-flow als
// ShareChampion en ShareEvening. Het tekenwerk zelf woont sinds #666 in
// profielPoster.ts.

export type { ProfileShareData };

export function ShareProfile({
  data,
  label = "↗ Deel profiel",
}: {
  data: ProfileShareData;
  label?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      // Profielfoto én het rastermaster van de special (#895) vooraf laden: het
      // canvas tekent synchroon, dus een nog niet gedecodeerd artwork zou als
      // niets op de poster belanden.
      const [avatarImg, master] = await Promise.all([
        laadAvatar(data.avatarUrl),
        laadKaartMaster(masterVoor(data.tier?.key, data.editie)),
      ]);
      const outcome = await sharePng(
        (ctx) => drawProfielPoster(ctx, data, avatarImg, master),
        {
          width: POSTER_W,
          height: POSTER_H,
          filename: "vamos-profiel.png",
          title: "Vamos! profiel",
        },
      );
      if (outcome === "clipboard")
        toast.success("Kaart gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Kaart gedownload.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn--sm" onClick={share} disabled={busy}>
      {busy ? "Bezig…" : label}
    </button>
  );
}

export default ShareProfile;