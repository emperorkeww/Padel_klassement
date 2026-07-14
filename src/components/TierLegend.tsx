import { CoachSneer } from "./CoachSneer";
import type { RoastCtx } from "@/features/coach/roastTone";
import { tierLegend } from "@/features/rating/tiers";
import "./TierLegend.css";

/** Pias van de week voor de voetnoot: de naam, hoe hoog de favoriet stond en de
 *  context waarmee Coach Rudy zijn sneer plaatst (#183/#287). */
export interface TierLegendPias {
  naam: string;
  /** Pre-match winkans van de verloren favoriet (0..1). */
  winChance: number;
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
export function TierLegend({ pias }: { pias?: TierLegendPias | null } = {}) {
  const rijen = tierLegend();
  return (
    <details className="tier-legend">
      <summary>Wat betekenen de divisies?</summary>
      <p className="tier-legend__intro">
        Je divisie volgt je rating — onderaan het Sletje van de baan, bovenaan
        de onaantastbare GOAT. Elke tier heeft drie niveaus (III → II → I); win je genoeg, dan
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
        {pias ? (
          <>
            {pias.beschermd ? "📊 Opvallende week" : "🤡 Pias van de week"}:{" "}
            <strong>{pias.naam}</strong> — ging als{" "}
            {pias.beschermd ? "favoriet" : "torenhoge favoriet"} (
            {Math.round(pias.winChance * 100)}%) onderuit.
          </>
        ) : (
          "🤡 Elke pias zweert dat-ie GOAT is — de rating liegt niet."
        )}
      </p>
      {pias && <CoachSneer ctx={pias.ctx} seed={pias.seed} size={26} />}
    </details>
  );
}

export default TierLegend;
