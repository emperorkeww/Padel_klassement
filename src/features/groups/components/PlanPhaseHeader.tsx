import { Link } from "react-router-dom";
import { PLAN_PHASES, type PlanPhase } from "../planFlowLogic";

/* ------------------------------------------------------------------ */
/* Fasebalk over de hele Plannen-tab (#349): waar staat de speeldag    */
/* in de reis, wat is de volgende stap, en altijd een plan-CTA.        */
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
  aantalSpeeldagen = 0,
  onPlan,
}: {
  /** Fase van de focus-poll; null zolang er geen speeldag loopt. */
  phase: PlanPhase | null;
  action: PlanAction | null;
  /** Aantal actieve speeldagen: vanaf twee zegt de balk dat er meer lopen. */
  aantalSpeeldagen?: number;
  onPlan: () => void;
}) {
  const activeIdx = phase ? PLAN_PHASES.indexOf(phase) : -1;

  return (
    <section className="card plan-phases">
      <div className="plan-phases__top">
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
        <button
          className="btn btn--sm btn--primary plan-phases__cta"
          onClick={onPlan}
        >
          + Plan een speeldag
        </button>
      </div>
      {action && (
        <p className="plan-phases__action">
          {/* De balk toont de fase van één speeldag; met meerdere lopende
              polls (#267) zou dat suggereren dat er maar één is (#721). */}
          {aantalSpeeldagen > 1 && (
            <span className="plan-phases__count">
              {aantalSpeeldagen} speeldagen lopen
            </span>
          )}
          {action.text}
          {action.to && (
            <Link to={action.to}>{action.linkText ?? "Bekijk →"}</Link>
          )}
        </p>
      )}
    </section>
  );
}
