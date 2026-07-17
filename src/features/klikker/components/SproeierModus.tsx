import { useCallback, useEffect, useRef, useState } from "react";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";
import { playSfx } from "@/lib/utils/sfx";
import { winPulse } from "@/lib/utils/haptics";
import { useShake } from "../useShake";
import { sproei } from "../sproeier";
import { SPROEIER_QUOTE } from "../klikkerData";

// Sproeier-Modus (#262): schud je telefoon en de beregeningsinstallatie slaat
// aan — sproeier-SFX, druppels over het scherm en een kletsnatte Rudy. Op
// desktop (of zonder toestemming) doet de testknop hetzelfde.

const NAT_MS = 4000;

export function SproeierModus() {
  const [nat, setNat] = useState(false);
  const natTimer = useRef<number | undefined>(undefined);
  // -Infinity: de allereerste trigger mag altijd, ook vlak na page-load.
  const laatste = useRef(-Infinity);

  const trigger = useCallback(() => {
    // Eigen throttle voor de knop; het schud-pad heeft daarnaast zijn cooldown.
    const nu = performance.now();
    if (nu - laatste.current < 2000) return;
    laatste.current = nu;
    winPulse();
    playSfx("sprinkler");
    sproei();
    setNat(true);
    window.clearTimeout(natTimer.current);
    natTimer.current = window.setTimeout(() => setNat(false), NAT_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(natTimer.current), []);

  const { status, vraagToestemming } = useShake(trigger);

  return (
    <section className="klikker-categorie sproeier">
      <h2 className="klikker-categorie__titel">
        <span aria-hidden="true">💦</span> Sproeier-Modus
      </h2>
      <p className="sproeier__uitleg">
        {status === "actief" || status === "toestemming-nodig"
          ? "Schud je telefoon en de beregeningsinstallatie slaat aan. Rudy staat er — uiteraard — weer middenin."
          : "De beregeningsinstallatie, op afroep. Rudy staat er — uiteraard — weer middenin."}
      </p>
      <div className="sproeier__acties">
        {status === "toestemming-nodig" && (
          <button type="button" className="btn btn--sm" onClick={() => void vraagToestemming()}>
            Zet schud-detectie aan
          </button>
        )}
        <button type="button" className="btn btn--sm" onClick={trigger}>
          💦 Test de sproeier
        </button>
      </div>
      {status === "geweigerd" && (
        <p className="sproeier__hint">
          Geen toestemming voor bewegingssensoren — schudden staat uit. (Weer
          aanzetten kan alleen via de Safari-instellingen.) De testknop werkt
          gewoon.
        </p>
      )}
      <div className="sproeier__toneel" aria-live="polite">
        {nat && (
          <div className="klikker-notitie__inhoud">
            <CoachAvatar
              size={56}
              mood="gemeen"
              className="klikker-notitie__face klikker-rudy--nat"
            />
            <p className="klikker-notitie__quote sproeier__quote">“{SPROEIER_QUOTE}”</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default SproeierModus;
