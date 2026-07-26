// De weergave van een gecrashte (deel)boom (#733). Bewust volledig zelfstandig:
// deze fallback draait óók wanneer de boundary bóven de providers staat, dus
// geen context (toast/auth/router), geen data en geen lazy import. Wat hier
// gerenderd wordt moet het altijd doen, anders krijg je alsnog het witte scherm.

import { coachCrash, coachVersie } from "@/features/coach/coachMoments";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import {
  herlaadNetGeprobeerd,
  isChunkLoadError,
  onthoudHerlaadpoging,
} from "@/lib/utils/chunkError";
import { applyUpdate, getSwUpdateSnapshot } from "@/lib/utils/swUpdate";
import "./ErrorBoundary.css";

/** Waar de boundary staat. Bepaalt of de fallback het hele scherm vult
 *  (root/route) of alleen het inhoudsvlak binnen de shell (pagina). */
export type CrashScope = "root" | "route" | "pagina";

/** Haalt de nieuwe versie binnen. Staat er een service worker te wachten
 *  (#463), activeer die dan — die herlaadt de pagina zelf via
 *  controllerchange. Anders volstaat een gewone herlaadbeurt. */
function haalNieuweVersie() {
  onthoudHerlaadpoging();
  if (getSwUpdateSnapshot()) {
    applyUpdate();
    return;
  }
  window.location.reload();
}

export function ErrorFallback({
  error,
  scope,
  onReset,
}: {
  error: Error;
  scope: CrashScope;
  onReset: () => void;
}) {
  // Een verdwenen chunk is geen crash maar een verouderde tab. Hielp herladen
  // zojuist al niet, dan is dat verhaal niet meer geloofwaardig en tonen we
  // gewoon de crash-weergave — die biedt óók "opnieuw proberen".
  const verouderd = isChunkLoadError(error) && !herlaadNetGeprobeerd();

  return (
    <div
      className={`crash ${scope === "pagina" ? "" : "crash--vol"}`}
      role="alert"
    >
      <div className="crash__inner">
        <p className="crash__title">
          {verouderd ? "Er is een nieuwe versie." : "Hier ging iets mis."}
        </p>
        <p className="crash__text">
          {verouderd
            ? "Deze pagina hoort nog bij een oudere versie van de app. Even herladen en je bent bij."
            : "Deze weergave is gestruikeld. Je gegevens zijn niets misgelopen — probeer het opnieuw, of herlaad de app."}
        </p>

        <CoachBubble mood="mild" size={34}>
          <span className="coach-sneer__text">
            {verouderd ? coachVersie(error.message) : coachCrash(error.message)}
          </span>
        </CoachBubble>

        <div className="btn-row crash__acties">
          {verouderd ? (
            <button className="btn btn--primary" onClick={haalNieuweVersie}>
              Herladen
            </button>
          ) : (
            <>
              <button className="btn btn--primary" onClick={onReset}>
                Opnieuw proberen
              </button>
              <button className="btn" onClick={() => window.location.reload()}>
                Herlaad de app
              </button>
            </>
          )}
        </div>

        {/* Ingeklapt, maar wél bereikbaar: hiermee kan een melding in de
            GitHub-issues meteen de echte foutmelding bevatten. */}
        <details className="crash__details">
          <summary>Technische details</summary>
          <p className="crash__melding">{error.message || String(error)}</p>
        </details>
      </div>
    </div>
  );
}

export default ErrorFallback;
