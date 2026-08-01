import { useState, type ReactNode } from "react";
import { readFlag, writeFlag } from "../flags";

/** localStorage-sleutel; dicht is de uitzondering, dus we bewaren "dicht". */
const SLEUTEL = "dash-cijfers-dicht";

/**
 * Het secundaire cijfer-blok van het overzicht, achter één inklapper (#911).
 *
 * De <details> stond eerder alleen om de gamification-extra's (#276), terwijl
 * de statsrij en de ratingkaart er los boven hingen. Daardoor las de pagina als
 * één lange rij gelijkwaardige kaarten: alles even belangrijk, dus niets. Nu
 * zit het hele "hoe sta ik ervoor"-blok in dezelfde inklapper, onder de zone
 * met wat vandaag speelt.
 *
 * Standaard open — de cijfers zijn de reden dat de meeste mensen hier komen.
 * Klapt iemand hem dicht, dan blijft dat zo, ook na een refresh.
 */
export function DashCijfers({ children }: { children: ReactNode }) {
  const [dicht, setDicht] = useState(() => readFlag(SLEUTEL));

  return (
    <details
      className="dash-cijfers"
      open={!dicht}
      onToggle={(e) => {
        const open = e.currentTarget.open;
        setDicht(!open);
        writeFlag(SLEUTEL, !open);
      }}
    >
      <summary className="dash-cijfers__summary">
        <span className="dash-cijfers__title">Jouw cijfers</span>
        <span className="dash-cijfers__hint">
          stand · rating · weekmissies · badges
        </span>
      </summary>
      <div className="dash-cijfers__body">{children}</div>
    </details>
  );
}

export default DashCijfers;
