import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useCacheRevision } from "@/lib/hooks/useCacheRevision";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { pushAvailability } from "@/lib/supabase/push";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Skeleton } from "@/ui/Skeleton";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { getMeldingenVenster, markeerAllesGelezen } from "./api";
import { MeldingenLijst } from "./components/MeldingenLijst";
import { PUSH_BELOFTE } from "./pushBelofte";
import "./Meldingen.css";

/**
 * De volledige meldingenlijst (#1090).
 *
 * Het paneel in de shell toont de laatste twintig; dit is de plek om door te
 * bladeren. Het is meteen het landingspunt voor wie iets terugzoekt dat hij op
 * zijn toestel al weggeveegd had — de reden dat #1090 bestaat.
 */
export function Meldingen() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  usePageTitle("Meldingen");

  const [paginas, setPaginas] = useState(1);
  const rev = useCacheRevision("meldingen");
  const venster = useAsync(
    () =>
      myId
        ? getMeldingenVenster(paginas)
        : Promise.resolve({ meldingen: [], meer: false }),
    [myId, paginas, rev],
  );
  const herlaad = venster.reload;
  const filter = useMemo(
    () => (myId ? `user_id=eq.${myId}` : undefined),
    [myId],
  );
  const opWijziging = useCallback(() => herlaad(), [herlaad]);
  useRealtime("notifications", opWijziging, filter);

  const [bezig, setBezig] = useState(false);
  const meldingen = venster.data?.meldingen ?? [];
  const ongelezen = meldingen.filter((m) => !m.read_at).length;

  async function allesGelezen() {
    setBezig(true);
    try {
      await markeerAllesGelezen();
      herlaad();
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="meldingen-pagina">
      <h1 className="page-title">Meldingen</h1>
      <p className="page-subtitle">
        Alles wat de app je gemeld heeft, ook wat je op je toestel al weggeveegd
        hebt. Na 90 dagen ruimt hij op.
      </p>

      <section className="card">
        {ongelezen > 0 && (
          <div className="meldingen__acties">
            <button
              type="button"
              className="btn btn--sm"
              onClick={allesGelezen}
              disabled={bezig}
            >
              {bezig ? "Bezig…" : "Alles gelezen"}
            </button>
          </div>
        )}

        {venster.error ? (
          <ErrorRetry melding={venster.error} onRetry={herlaad} />
        ) : venster.loading && meldingen.length === 0 ? (
          <Skeleton rows={6} />
        ) : meldingen.length === 0 ? (
          <LegeStaat />
        ) : (
          <>
            <MeldingenLijst meldingen={meldingen} onVeranderd={herlaad} />
            {venster.data?.meer && (
              <div className="meldingen-pagina__meer">
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setPaginas((p) => p + 1)}
                  disabled={venster.loading}
                >
                  {venster.loading ? "Laden…" : "Meer laden"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/**
 * De lege staat zegt iets in plaats van een streep te trekken. Staat push nog
 * uit, dan is dit de logische plek om naar de schakelaar te wijzen — met
 * dezelfde belofte als PushPrompt op het dashboard (PUSH_BELOFTE), niet een
 * tweede variant ervan.
 */
function LegeStaat() {
  const pushUit = pushAvailability() !== "ready";
  return (
    <EmptyState
      icon="🔔"
      title="Nog niets te melden"
      action={
        pushUit ? (
          <Link className="btn btn--sm btn--primary" to="/profiel">
            Naar je instellingen
          </Link>
        ) : undefined
      }
    >
      {pushUit
        ? `Zodra er een ronde klaarstaat, een uitslag binnenkomt of iemand je een verzoek stuurt, staat het hier. Wil je het ook meteen weten? ${PUSH_BELOFTE}`
        : "Zodra er een ronde klaarstaat, een uitslag binnenkomt of iemand je een verzoek stuurt, staat het hier."}
    </EmptyState>
  );
}

export default Meldingen;
