import { Link } from "react-router-dom";
import { PLAN_PHASES, type PlanPhase } from "../planFlowLogic";

/* ------------------------------------------------------------------ */
/* Fasebalk over de hele Plannen-tab (#349): waar staat de speeldag    */
/* in de reis, wat is de volgende stap, en altijd een plan-CTA.        */
/*                                                                     */
/* Sinds #839 noemt de balk óók welke speeldag ze bedoelt. Ze praat    */
/* over precies één focus-poll, maar liet die ongenoemd: bij twee of   */
/* drie gelijktijdige speeldagen was niet duidelijk vóór welke de      */
/* actietekst gold. De datum staat nu in de kop in plaats van in de    */
/* zin, en het aantal andere speeldagen wijst naar beneden.            */
/*                                                                     */
/* De banen-link hoort hier ook: hij stond als kale paragraaf onder    */
/* aan de tab, tussen verder alleen kaarten, terwijl plan-acties nu    */
/* eenmaal in deze kop wonen.                                          */
/* ------------------------------------------------------------------ */

const PHASE_LABELS: Record<PlanPhase, string> = {
  stemmen: "Stemmen",
  gekozen: "Gekozen",
  geboekt: "Geboekt",
  klaar: "Klaar",
};

export type PlanAction = {
  text: string;
  /** Optionele vervolg-link achter de tekst (bv. naar de wedstrijden). */
  to?: string;
  linkText?: string;
};

export function PlanPhaseHeader({
  phase,
  action,
  focusWanneer,
  aantalSpeeldagen = 0,
  banenHref,
  onPlan,
}: {
  /** Fase van de focus-poll; null zolang er geen speeldag loopt. */
  phase: PlanPhase | null;
  action: PlanAction | null;
  /** De speeldag waar deze balk over gaat, bv. "do 7 aug · 20:00". */
  focusWanneer?: string | null;
  /** Aantal actieve speeldagen: vanaf twee zegt de balk dat er meer lopen. */
  aantalSpeeldagen?: number;
  /** Vrije banen van vandaag; ontbreekt = geen link. */
  banenHref?: string;
  onPlan: () => void;
}) {
  const activeIdx = phase ? PLAN_PHASES.indexOf(phase) : -1;
  const andere = Math.max(0, aantalSpeeldagen - 1);

  return (
    <section className="card plan-phases">
      <div className="plan-phases__top">
        <h2 className="plan-phases__wie">
          {focusWanneer ? (
            <>
              <span className="plan-phases__wie-label">Volgende</span>
              {focusWanneer}
            </>
          ) : (
            "Speeldag plannen"
          )}
        </h2>
        <button
          className="btn btn--sm btn--primary plan-phases__cta"
          onClick={onPlan}
        >
          + Plan een speeldag
        </button>
      </div>

      <ol
        className={`plan-phases__steps${phase ? "" : " is-idle"}`}
        aria-label="Fase van de speeldag"
      >
        {PLAN_PHASES.map((p, i) => (
          <li
            key={p}
            className={`plan-phases__step${i === activeIdx ? " is-active" : ""}${activeIdx >= 0 && i < activeIdx ? " is-done" : ""}`}
          >
            {i === activeIdx && (
              <span aria-hidden="true" className="plan-phases__ball">
                🎾
              </span>
            )}
            {PHASE_LABELS[p]}
          </li>
        ))}
      </ol>

      {action && (
        <p className="plan-phases__action">
          {action.text}
          {action.to && (
            <Link to={action.to}>{action.linkText ?? "Bekijk →"}</Link>
          )}
        </p>
      )}

      <p className="plan-phases__extra">
        {/* De balk toont de fase van één speeldag; met meerdere lopende polls
            (#267) zou dat suggereren dat er maar één is (#721). */}
        {andere > 0 && (
          <span className="plan-phases__count">
            +{andere} andere {andere === 1 ? "speeldag" : "speeldagen"}{" "}
            hieronder
          </span>
        )}
        {banenHref && (
          <Link className="plan-phases__banen" to={banenHref}>
            🎾 Vrije banen bekijken →
          </Link>
        )}
      </p>
    </section>
  );
}
