import { Link } from "react-router-dom";
import { CoachSneer } from "@/features/coach/components/CoachSneer";
import { sectieHref } from "@/features/uitleg/secties";
import type { RoastCtx } from "@/features/coach/roastTone";
import { piasDetail, type PiasReden } from "@/features/groups/maandpias";
import { tierLegend } from "@/features/rating/tiers";
import "./TierLegend.css";

/** Pias van de week voor de voetnoot: de naam, waarom (#643: anti-MVP-reden)
 *  en de context waarmee Coach Rudy zijn sneer plaatst (#183/#287). */
export interface TierLegendPias {
  naam: string;
  /** Waarom deze speler de pias is (bagel/afdroging/zwarte reeks/choke). */
  reden: PiasReden;
  /** Het reden-specifieke getal voor de omschrijving (piasDetail). */
  waarde: number;
  /** Heeft de pias zijn roast-schild aan? Dan tonen we een neutrale voetnoot. */
  beschermd: boolean;
  /** Roast-context (toon + schild) van de pias. */
  ctx: RoastCtx;
  /** Deterministische seed → dezelfde burn voor de hele groep. */
  seed: number;
}

/**
 * Uitklapbare uitleg (#127): wat de divisies betekenen en bij welke rating je
 * in welke tier zit. Zelfde <details>-patroon als de klassement-filters.
 *
 * De voetnoot noemt sinds #127 de echte pias van de week (grootste choke) als
 * die er is; anders valt hij terug op de vaste grap — het easter egg verdwijnt
 * nooit.
 */
export function TierLegend({
  pias,
  toonUitlegLink = false,
}: {
  pias?: TierLegendPias | null;
  /** Wegwijzer naar /uitleg#tiers eronder (#989). Standaard uit: de
   *  uitlegpagina rendert dit paneel zélf. De Divisies-tab zet 'm aan. */
  toonUitlegLink?: boolean;
} = {}) {
  const rijen = tierLegend();
  return (
    <details className="tier-legend">
      <summary>Wat betekenen de divisies?</summary>
      <p className="tier-legend__intro">
        Je divisie volgt je rating — onderaan het Sletje van de baan, bovenaan
        de absolute dictator: El Padelissimo. Elke divisie onder de top heeft drie sub-niveaus (III → II → I).
        Alleen op de troon van El Padelissimo regeer je ongedeeld en zonder sub-niveaus.
      </p>
      <ul className="tier-legend__list">
        {rijen.map((r) => (
          <li key={r.key} className={`tier-legend__row tier-legend--${r.key}`}>
            <span className="tier-legend__emoji" aria-hidden="true">
              {r.emoji}
            </span>
            <span className="tier-legend__body">
              <span className="tier-legend__naam">{r.naam}</span>
              <span className="tier-legend__flavor">{r.flavor}</span>
            </span>
            <span className="tier-legend__req">
              <span className="tier-legend__nodig">
                {r.vanaf != null ? `vanaf ${r.vanaf}` : "instap"}
              </span>
              <span className="tier-legend__range">{r.range}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="tier-legend__pias">
        {pias ? (
          <>
            {pias.beschermd ? "📊 Opvallende week" : "🤡 Pias van de week"}:{" "}
            <strong>{pias.naam}</strong> —{" "}
            {pias.beschermd
              ? "had een week om snel te vergeten."
              : `${piasDetail(pias.reden, pias.waarde)}.`}
          </>
        ) : (
          "🤡 Elke pias waant zich de sportief directeur van de club — de rating liegt niet."
        )}
      </p>
      {pias && <CoachSneer ctx={pias.ctx} seed={pias.seed} size={26} />}
      {toonUitlegLink && (
        <p className="tier-legend__uitleg">
          <Link to={sectieHref("tiers")}>Meer uitleg over de app →</Link>
        </p>
      )}
    </details>
  );
}

export default TierLegend;
