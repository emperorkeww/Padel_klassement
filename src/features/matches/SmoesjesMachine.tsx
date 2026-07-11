// Smoesjesmachine (#167): op een verloren match één tik → een ludiek excuus,
// deelbaar met de vriendengroep. De keuze is deterministisch geseed op het
// match-id + een worp-teller, zodat "opnieuw" een vers smoesje trekt maar de
// getoonde smoes stabiel blijft binnen één weergave.

import { useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { tap } from "../../lib/haptics";
import { shareOrCopyText } from "../../lib/shareText";
import { hashString, kiesSmoes } from "../../lib/excuses";
import "./SmoesjesMachine.css";

export function SmoesjesMachine({ matchId }: { matchId: string }) {
  const toast = useToast();
  const [worp, setWorp] = useState<number | null>(null);

  const seed = hashString(matchId) + (worp ?? 0);
  const smoes = worp === null ? null : kiesSmoes(seed);

  function trek() {
    tap();
    setWorp((w) => (w === null ? 0 : w + 1));
  }

  async function deel() {
    if (!smoes) return;
    try {
      const outcome = await shareOrCopyText({
        title: "Mijn smoesje 🎾",
        text: `Waarom ik verloor: ${smoes}`,
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

      {smoes ? (
        <p className="smoesjes__quote">“{smoes}”</p>
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
