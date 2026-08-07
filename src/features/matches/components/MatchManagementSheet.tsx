import { useState, type ReactNode } from "react";
import { Sheet } from "@/ui/Sheet";
import "./MatchManagementSheet.css";

/** Eén beheeractie. Precies één van `onClick` of `inhoud` is zinvol. */
export interface BeheerActie {
  sleutel: string;
  label: string;
  /** Eén regel eronder: wat er gebeurt, of waarom het kan. */
  hint?: string;
  /** Rood, en met een streep boven zich: verwijderen hoort niet tussen de rest. */
  gevaarlijk?: boolean;
  /** Direct uitvoeren; de sheet sluit daarna. */
  onClick?: () => void;
  /** Of: een paneel dat in de sheet openklapt (formulieren, kiezers). */
  inhoud?: ReactNode;
}

/**
 * Het ene beheermenu van een match (#1144).
 *
 * Beheer zat op twee plekken: een ⋯-sheet op de kaart (tijd, verwijderen) en de
 * "Beheer & correcties"-inklapper op het matchdetail (netrollers, groep,
 * gastspeler). Dezelfde match, twee menu's, en welke actie waar zat viel niet
 * te raden. Nu één ingang, met de acties die de kijker écht mag.
 *
 * Welke acties dat zijn beslist de aanroeper, en met opzet: de poorten
 * verschillen per actie en zijn geen van alle "mag beheren". set_match_group
 * eist lidmaatschap van bron- én doelgroep, replace_match_player eist aanmaker
 * of groepseigenaar, delete_match weigert een afgeronde match, en netrollers
 * vult alleen wie zelf meespeelde. Eén samengevoegde vlag zou drie van die
 * vier verkeerd hebben.
 */
export function MatchManagementSheet({
  open,
  acties,
  onClose,
  titel = "Matchbeheer",
}: {
  open: boolean;
  acties: BeheerActie[];
  onClose: () => void;
  titel?: string;
}) {
  const [gekozen, setGekozen] = useState<string | null>(null);
  if (!open || acties.length === 0) return null;

  const actie = acties.find((a) => a.sleutel === gekozen) ?? null;

  function sluit() {
    setGekozen(null);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={sluit}
      title={actie ? actie.label : titel}
      compact
    >
      {actie?.inhoud ? (
        <div className="beheer__paneel">
          <button
            type="button"
            className="btn btn--sm beheer__terug"
            onClick={() => setGekozen(null)}
          >
            ← Alle acties
          </button>
          {actie.inhoud}
        </div>
      ) : (
        <ul className="beheer__lijst">
          {acties.map((a) => (
            <li
              key={a.sleutel}
              className={a.gevaarlijk ? "beheer__item--gevaarlijk" : undefined}
            >
              <button
                type="button"
                className={`beheer__actie${a.gevaarlijk ? " is-gevaarlijk" : ""}`}
                onClick={() => {
                  if (a.inhoud) {
                    setGekozen(a.sleutel);
                    return;
                  }
                  sluit();
                  a.onClick?.();
                }}
              >
                <span className="beheer__label">{a.label}</span>
                {a.hint && <span className="beheer__hint">{a.hint}</span>}
                {a.inhoud && (
                  <span className="beheer__pijl" aria-hidden="true">
                    ›
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

export default MatchManagementSheet;
