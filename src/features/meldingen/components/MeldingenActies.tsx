import { useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { markeerAllesGelezen, zetAllesOngelezen } from "../api";

/**
 * De actiebalk boven de lijst (#1273).
 *
 * Stond in twee kopieën (paneel en route) en verscheen alleen als er iets
 * ongelezen was — dus sprong hij in en uit de lay-out en duwde hij de lijst een
 * rij op en neer, precies terwijl je erop wilde tikken. Nu één component, altijd
 * op zijn plek, uitgeschakeld als er niets te markeren valt.
 *
 * En met een weg terug: wie hem indrukte om van de badge af te komen was ook de
 * vier dingen kwijt die hij nog moest doen.
 */
export function MeldingenActies({
  ongelezen,
  onVeranderd,
}: {
  ongelezen: number;
  onVeranderd: () => void;
}) {
  const [bezig, setBezig] = useState(false);
  const toast = useToast();

  async function allesGelezen() {
    setBezig(true);
    try {
      const ids = await markeerAllesGelezen();
      onVeranderd();
      if (ids.length > 0) {
        toast.success("Alles gelezen — tik om terug te zetten", {
          onClick: () => {
            void zetAllesOngelezen(ids).then(onVeranderd);
          },
        });
      }
    } catch {
      toast.error("Dat lukte niet. Probeer het zo nog eens.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="meldingen__acties">
      <button
        type="button"
        className="btn btn--sm"
        onClick={() => void allesGelezen()}
        disabled={bezig || ongelezen === 0}
      >
        {bezig ? "Bezig…" : "Alles gelezen"}
      </button>
    </div>
  );
}

export default MeldingenActies;
