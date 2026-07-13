// Smoesjesmachine (#167): op een verloren match één tik → een ludiek excuus,
// deelbaar met de vriendengroep. De keuze is deterministisch geseed op het
// match-id + een worp-teller, zodat "opnieuw" een vers smoesje trekt maar de
// getoonde smoes stabiel blijft binnen één weergave.
//
// Onder Coach Rudy's stem (#296): het excuus verschijnt in zijn speech-bubbel
// (avatar + naam) en Rudy velt als juryvoorzitter een deterministisch oordeel
// (❌/⚠️/✅) over elk smoesje. Bij roast-schild een neutrale toon.

import { useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { CoachBubble } from "../../components/CoachBubble";
import { errorMessage } from "../../lib/errors";
import { tap } from "../../lib/haptics";
import { shareOrCopyText } from "../../lib/shareText";
import { hashString, kiesSmoes, kiesOordeel } from "../../lib/excuses";
import { COMMENTATOR, type RoastCtx } from "../../lib/roastTone";
import "./SmoesjesMachine.css";

export function SmoesjesMachine({
  matchId,
  ctx,
}: {
  matchId: string;
  /** Roast-context van de kijker (toon + schild); stuurt Rudy's mood en oordeel. */
  ctx: RoastCtx;
}) {
  const toast = useToast();
  const [worp, setWorp] = useState<number | null>(null);

  const seed = hashString(matchId) + (worp ?? 0);
  const smoes = worp === null ? null : kiesSmoes(seed);
  const oordeel = smoes ? kiesOordeel(smoes, ctx.schild) : null;
  // Rudy's illustratie volgt de groepstoon; met schild blijft hij neutraal.
  const mood = ctx.schild ? "portret" : ctx.intensiteit;

  function trek() {
    tap();
    setWorp((w) => (w === null ? 0 : w + 1));
  }

  async function deel() {
    if (!smoes) return;
    try {
      const oordeelDeel = oordeel ? `\n${COMMENTATOR.naam}: ${oordeel.tekst}` : "";
      const outcome = await shareOrCopyText({
        title: "Mijn smoesje 🎾",
        text: `Waarom ik verloor: “${smoes}”${oordeelDeel}`,
      });
      if (outcome === "clipboard") toast.success("Smoesje gekopieerd naar klembord.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(errorMessage(err));
    }
  }

  return (
    <section className="card smoesjes">
      <div className="card__head">
        <h2 className="card__title">🙈 Smoesjesmachine</h2>
        {smoes && (
          <button className="btn btn--sm" onClick={deel}>
            ↗ Deel
          </button>
        )}
      </div>

      {smoes && oordeel ? (
        <CoachBubble mood={mood}>
          <span className="coach-sneer__text smoesjes__quote">“{smoes}”</span>
          <span className={`smoesjes__oordeel smoesjes__oordeel--${oordeel.gradatie}`}>
            {oordeel.tekst}
          </span>
        </CoachBubble>
      ) : (
        <p className="smoesjes__hint">
          Verloren? Geen zorgen — er is altijd een goede reden.
        </p>
      )}

      <button className="btn btn--sm smoesjes__trek" onClick={trek}>
        {smoes ? "Nog een smoesje" : "Geef me een smoesje"}
      </button>
    </section>
  );
}

export default SmoesjesMachine;
