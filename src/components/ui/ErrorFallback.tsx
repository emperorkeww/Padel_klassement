// De weergave van een gecrashte (deel)boom (#733). Bewust volledig zelfstandig:
// deze fallback draait óók wanneer de boundary bóven de providers staat, dus
// geen context (toast/auth/router), geen data en geen lazy import. Wat hier
// gerenderd wordt moet het altijd doen, anders krijg je alsnog het witte scherm.

import { coachCrash } from "@/features/coach/coachMoments";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import "./ErrorBoundary.css";

/** Waar de boundary staat. Bepaalt of de fallback het hele scherm vult
 *  (root/route) of alleen het inhoudsvlak binnen de shell (pagina). */
export type CrashScope = "root" | "route" | "pagina";

export function ErrorFallback({
  error,
  scope,
  onReset,
}: {
  error: Error;
  scope: CrashScope;
  onReset: () => void;
}) {
  return (
    <div
      className={`crash ${scope === "pagina" ? "" : "crash--vol"}`}
      role="alert"
    >
      <div className="crash__inner">
        <p className="crash__title">Hier ging iets mis.</p>
        <p className="crash__text">
          Deze weergave is gestruikeld. Je gegevens zijn niets misgelopen —
          probeer het opnieuw, of herlaad de app.
        </p>

        <CoachBubble mood="mild" size={34}>
          <span className="coach-sneer__text">{coachCrash(error.message)}</span>
        </CoachBubble>

        <div className="btn-row crash__acties">
          <button className="btn btn--primary" onClick={onReset}>
            Opnieuw proberen
          </button>
          <button className="btn" onClick={() => window.location.reload()}>
            Herlaad de app
          </button>
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
