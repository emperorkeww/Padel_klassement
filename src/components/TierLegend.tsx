import { tierLegend } from "../lib/tiers";
import "./TierLegend.css";

/**
 * Uitklapbare uitleg (#127): wat de divisies betekenen en bij welke rating je
 * in welke tier zit. Zelfde <details>-patroon als de klassement-filters.
 */
export function TierLegend() {
  const rijen = tierLegend();
  return (
    <details className="tier-legend">
      <summary>Wat betekenen de divisies?</summary>
      <p className="tier-legend__intro">
        Je divisie volgt je rating — van hopeloze Sloffer tot onaantastbare
        GOAT. Elke tier heeft drie niveaus (III → II → I); win je genoeg, dan
        klim je omhoog (en verlies je te veel, dan zak je genadeloos weg).
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
        🤡 Twijfelgeval? De pias van de groep zweert dat-ie GOAT is — de rest
        weet wel beter.
      </p>
    </details>
  );
}

export default TierLegend;
