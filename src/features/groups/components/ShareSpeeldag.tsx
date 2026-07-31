import { useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { sharePng } from "@/lib/utils/shareImage";
import { laadAvatar } from "@/lib/utils/futKaartCanvas";
import {
  laadKaartMasters,
  masterVoor,
} from "@/features/rating/components/kaartMasters";
import { getPlayerRatings } from "@/features/standings/ratingsApi";
import { laadEditieContext } from "@/features/standings/editieContext";
import { vsKaartVoor } from "@/features/profiles/compare";
import { displayName } from "@/features/profiles/api";
import type { KaartData } from "@/features/profiles/profielPoster";
import type { Profile } from "@/types";
import {
  drawSpeeldagPoster,
  speeldagPoster,
  POSTER_H,
  POSTER_W,
} from "../speeldagPoster";

/* ------------------------------------------------------------------ */
/* Delen van een geboekte speeldag (#675): tekst óf een PNG-poster met */
/* de FUT-kaarten van de bevestigde deelnemers. Zelfde twee-knoppen-   */
/* patroon als ShareAvailability; de laad-en-teken-flow komt van       */
/* ShareProfile.                                                       */
/* ------------------------------------------------------------------ */

export function ShareSpeeldag({
  groupName,
  moment,
  club,
  deelnemers,
  profiles,
  bestand,
  onShareText,
  accessCode,
  shareUrl,
}: {
  groupName: string;
  /** Bv. "vrijdag 10 januari · 20:00". */
  moment: string;
  /** Bv. "LAGO CLUB Padel Beveren · 90 min". */
  club: string;
  /** Player-id's van de ja-stemmers. */
  deelnemers: string[];
  profiles: Record<string, Profile>;
  /** Bestandsnaam van de poster, bv. "padel-2030-01-10.png". */
  bestand: string;
  onShareText: () => void | Promise<void>;
  /** Toegangscode van de poll; null als er geen is. */
  accessCode: string | null;
  /** Deep-link naar deze speeldag — als QR op de poster, achter een opt-in. */
  shareUrl: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<"tekst" | "poster" | null>(null);
  // Standaard uit (#675): een poster wordt doorgestuurd en blijft in
  // fotorollen staan, dus de code komt er alleen op als je dat zelf aanzet.
  const [codeOpPoster, setCodeOpPoster] = useState(false);
  // Zelfde afweging voor de QR (#886): hij opent de speeldag in de app en is
  // member-only, maar een doorgestuurde poster draagt 'm wel mee.
  const [qrOpPoster, setQrOpPoster] = useState(false);

  async function deelTekst() {
    setBusy("tekst");
    try {
      await onShareText();
    } finally {
      setBusy(null);
    }
  }

  async function deelPoster() {
    setBusy("poster");
    try {
      // Pas op dit moment ophalen — de Plannen-tab hoeft de ratings en
      // editie-context niet bij elke render te kennen. Alles zit achter
      // cached(), dus meestal is dit gratis.
      const [ratings, edities] = await Promise.all([
        getPlayerRatings(),
        laadEditieContext(),
      ]);
      const spelers: KaartData[] = deelnemers
        .filter((id) => profiles[id])
        .map((id) => {
          const kaart = vsKaartVoor({
            id,
            profile: profiles[id],
            naam: displayName(profiles[id]),
            ratings,
            edities,
          });
          return {
            name: kaart.naam,
            avatarUrl: kaart.avatarUrl,
            rating: kaart.rating,
            tier: kaart.tier,
            editie: kaart.editie,
            editieTekst: kaart.editieTekst,
          };
        });
      if (spelers.length === 0) {
        toast.error("Nog geen bevestigde deelnemers om te delen.");
        return;
      }

      const poster = speeldagPoster({
        groepsnaam: groupName,
        moment,
        club,
        spelers,
        code: codeOpPoster ? accessCode : null,
        link: qrOpPoster ? shareUrl : null,
      });
      // Alleen de kaarten die getekend worden hebben een avatar nodig. Idem
      // voor de rastermasters van de specials (#895): `laadKaartMasters`
      // bundelt dubbele edities tot één laadbeurt, dus acht kaarten halen het
      // storm-artwork hooguit één keer op.
      const [avatars, masters] = await Promise.all([
        Promise.all(poster.kaarten.map((k) => laadAvatar(k.avatarUrl))),
        laadKaartMasters(
          poster.kaarten.map((k) => masterVoor(k.tier?.key, k.editie)),
        ),
      ]);
      const outcome = await sharePng(
        (ctx) => drawSpeeldagPoster(ctx, poster, avatars, masters),
        { width: POSTER_W, height: POSTER_H, filename: bestand, title: "Padel-opstelling" },
      );
      if (outcome === "clipboard") toast.success("Poster gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Poster gedownload.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="share-speeldag">
      <div className="winner-card__actions">
        <button className="btn btn--sm" disabled={busy !== null} onClick={deelTekst}>
          {busy === "tekst" ? "Bezig…" : "↗ Tekst"}
        </button>
        <button className="btn btn--sm" disabled={busy !== null} onClick={deelPoster}>
          {busy === "poster" ? "Bezig…" : "🖼 Afbeelding"}
        </button>
      </div>
      {accessCode != null && (
        <label className="share-speeldag__optin">
          <input
            type="checkbox"
            checked={codeOpPoster}
            onChange={(e) => setCodeOpPoster(e.target.checked)}
          />
          <span>
            Toegangscode op de poster
            <em> — de afbeelding wordt vaak doorgestuurd</em>
          </span>
        </label>
      )}
      <label className="share-speeldag__optin">
        <input
          type="checkbox"
          checked={qrOpPoster}
          onChange={(e) => setQrOpPoster(e.target.checked)}
        />
        <span>
          QR naar de speeldag
          <em> — scannen opent 'm in de app, alleen voor groepsleden</em>
        </span>
      </label>
    </div>
  );
}

export default ShareSpeeldag;
