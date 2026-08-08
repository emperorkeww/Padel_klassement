import { useState } from "react";
import { useConfirm } from "@/ui/ConfirmDialog";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { herbereken, HERBEREKEN_STAPPEN } from "../api";

// De klassementketen opnieuw laten lopen (#1049).
//
// De vijf recompute_*-functies draaiden tot nu toe uitsluitend via de triggers
// op `matches`, of als `postgres` in de SQL-editor: ze hadden geen enkele grant,
// ook niet aan service_role. Na een correctie met de hand was de enige manier om
// de keten opnieuw te laten lopen een dummy-update op `matches`.
//
// Die omweg was niet onschuldig. Aan `matches` hangen push_on_match_update-
// triggers, dus een dummy-update stuurt pushmeldingen de deur uit over een
// wedstrijd waar niets aan veranderd is. Deze knop raakt `matches` niet en vuurt
// dus geen enkele webhook af.

export function HerberekenBlok() {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const [bezig, setBezig] = useState<string | null>(null);
  const [klaar, setKlaar] = useState<string[]>([]);

  async function draaiAlles() {
    if (
      !(await confirm({
        title: "Hele klassementketen herberekenen",
        body: (
          <>
            <p>
              Dit draait alle vijf de onderdelen opnieuw, in de volgorde waarin
              de triggers op wedstrijden ze zouden draaien. Bij een consistente
              databank verandert er niets; is er met de hand gecorrigeerd, dan
              worden ratings, Pias, stijgers, termijnen en Zwarte Piet
              bijgetrokken.
            </p>
            <p>
              Er gaan géén pushmeldingen uit — anders dan bij de dummy-update op
              een wedstrijd die hiervoor de enige route was.
            </p>
          </>
        ),
        confirmLabel: "Herberekenen",
      }))
    ) {
      return;
    }

    setKlaar([]);
    try {
      // Eén voor één en op volgorde: vijf volledige herberekeningen in één
      // verzoek lopen tegen de tijdslimiet van de edge function aan, en de
      // latere onderdelen lezen wat de eerdere schrijven.
      for (const stap of HERBEREKEN_STAPPEN) {
        setBezig(stap.id);
        const uit = await herbereken(stap.id);
        setKlaar((k) => [...k, `${stap.label}: ${uit.duur_ms} ms`]);
      }
      toast.success("Klassementketen herberekend.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBezig(null);
    }
  }

  const bezigLabel = HERBEREKEN_STAPPEN.find((s) => s.id === bezig)?.label;

  return (
    <div className="admin-detail__blok">
      <h3>Herberekenen</h3>
      <p className="admin-match__sub">
        Laat de hele klassementketen opnieuw lopen na een handmatige correctie.
        Raakt geen wedstrijden aan en stuurt dus geen pushmeldingen.
      </p>

      <div className="admin-acties">
        <button
          type="button"
          className="btn btn--sm"
          onClick={draaiAlles}
          disabled={bezig !== null}
        >
          {bezig ? `Bezig: ${bezigLabel}…` : "Alles herberekenen"}
        </button>
      </div>

      {klaar.length > 0 && (
        <ul className="admin-lijst">
          {klaar.map((r) => (
            <li key={r} className="admin-lijst__rij">
              <span className="admin-audit__meta">{r}</span>
            </li>
          ))}
        </ul>
      )}

      {confirmUi}
    </div>
  );
}
