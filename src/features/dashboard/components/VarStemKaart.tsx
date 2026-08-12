import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/ui/ToastProvider";
import { tap } from "@/lib/utils/haptics";
import { appealFoutMelding, draaitWinnaarOm } from "@/features/matches/appeal";
import { castAppealVote } from "@/features/matches/appealApi";
import type { AsyncState } from "@/lib/hooks/useAsync";
import type { Stemzaak } from "../varZaken";
import "./VarStemKaart.css";

// Rudy's VAR (#1025) op het overzicht: de zaken die op jóuw stem wachten.
// Sinds #1242 puur presentationeel — de data komt uit useDashboardData
// (varZaken.ts), zodat de Vandaag-zone weet of er een zaak is voordat deze
// kaart rendert.

export function VarStemKaart({
  myId,
  zaken,
}: {
  myId: string;
  /** De zaken die op mijn stem wachten, uit useDashboardData. */
  zaken: AsyncState<Stemzaak[]>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const lijst = zaken.data ?? [];
  if (lijst.length === 0) return null;

  async function stem(zaak: Stemzaak, akkoord: boolean) {
    if (busy) return;
    setBusy(zaak.appeal.id);
    try {
      await castAppealVote({
        appealId: zaak.appeal.id,
        voterId: myId,
        akkoord,
      });
      tap();
      toast.success(akkoord ? "Genoteerd: klopt." : "Genoteerd: onzin.");
      zaken.reload();
    } catch (err) {
      toast.error(appealFoutMelding(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card varkaart" aria-label="VAR-zaak">
      <div className="card__head">
        <h2 className="card__title card__title--tight">
          📺 {lijst.length === 1 ? "Een zaak" : `${lijst.length} zaken`} voor de
          VAR
        </h2>
      </div>

      {lijst.map((z) => (
        <div key={z.appeal.id} className="varkaart__zaak">
          <p className="varkaart__claim">
            <strong>{z.claimant}</strong> betwist één punt: {z.reden}
            {z.appeal.set_number != null && ` (set ${z.appeal.set_number})`}.
            {z.appeal.toelichting && <em> “{z.appeal.toelichting}”</em>}
          </p>

          {z.na && (
            <p className="varkaart__score">
              <span className="varkaart__score-oud">
                {z.appeal.snapshot_a} – {z.appeal.snapshot_b}
              </span>
              <span aria-hidden="true"> ▸ </span>
              <span className="varkaart__score-nieuw">
                {z.na.scoreA} – {z.na.scoreB}
              </span>
              {draaitWinnaarOm(z.match, z.na) && (
                <span className="varkaart__waarschuwing">
                  {" "}
                  — dit draait de winnaar om
                </span>
              )}
            </p>
          )}

          <div className="varkaart__acties">
            <button
              type="button"
              className="varkaart__knop varkaart__knop--voor"
              disabled={busy === z.appeal.id}
              onClick={() => stem(z, true)}
            >
              Klopt
            </button>
            <button
              type="button"
              className="varkaart__knop varkaart__knop--tegen"
              disabled={busy === z.appeal.id}
              onClick={() => stem(z, false)}
            >
              Onzin
            </button>
            <Link className="btn btn--sm" to={`/matches/${z.match.id}`}>
              Bekijk de match →
            </Link>
          </div>
        </div>
      ))}

      <p className="varkaart__foot">
        Stemmen gaan met naam. Wie zwijgt, stemt niet mee — en dan blijft de
        uitslag staan.
      </p>
    </section>
  );
}

export default VarStemKaart;
