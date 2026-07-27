import type { ReactNode } from "react";

/** Titel-crest in de hero (#287, herzien #317 en #771): een leesbaar chip met
 *  emoji + label, plus een tooltip met de langere uitleg. De tooltip verschijnt op
 *  hover (desktop) én op focus, dus een tik op mobiel onthult 'm ook. `aria-label`
 *  bevat de volledige uitleg voor schermlezers.
 *
 *  Sinds #771 heeft de crest twee maten. `prominent` maakt hem de statusbadge van
 *  de kaart: dezelfde chip, groter en in het materiaal van het actieve thema. Dat
 *  is bewust dezelfde component en geen tweede badge-component — anders staan er
 *  twee tooltip-implementaties en twee toegankelijkheidsverhalen naast elkaar voor
 *  wat dezelfde titel is. Welke status prominent staat, beslist DashboardHero. */
export function HeroCrest({
  variant,
  emoji,
  label,
  uitleg,
  prominent = false,
  icoon,
}: {
  variant:
    | "bigdaddy"
    | "piet"
    | "pias"
    | "dictator"
    | "kampioen"
    | "inform"
    | "onfire";
  emoji: string;
  label: string;
  uitleg: string;
  /** Toon deze crest als statusbadge van de kaart (#771). */
  prominent?: boolean;
  /** Eigen SVG-icoon in plaats van de emoji (#771). De emoji blijft de bron van
   *  waarheid voor de tekst — dit vervangt alleen de tekening, voor titels
   *  waarvan het teken per platform anders (of ronduit verkeerd) uitvalt: de
   *  clown die op sommige toestellen een horrorgezicht is, het speelkaart-teken
   *  dat nergens op een pion lijkt. */
  icoon?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`hero-crest hero-crest--${variant}${
        prominent ? " hero-crest--badge" : ""
      }`}
      aria-label={`${label}: ${uitleg}`}
    >
      <span
        className={`hero-crest__icon${icoon ? " hero-crest__icon--svg" : ""}`}
        aria-hidden="true"
      >
        {icoon ?? emoji}
      </span>
      <span className="hero-crest__label">{label}</span>
      <span className="hero-crest__tip" role="tooltip" aria-hidden="true">
        <span className="hero-crest__tip-label">{label}</span>
        <span className="hero-crest__tip-text">{uitleg}</span>
      </span>
    </button>
  );
}
