/** Titel-crest in de hero (#287, herzien #317): een leesbaar chip met emoji +
 *  label, plus een tooltip met de langere uitleg. De tooltip verschijnt op hover
 *  (desktop) én op focus, dus een tik op mobiel onthult 'm ook. `aria-label` bevat
 *  de volledige uitleg voor schermlezers. */
export function HeroCrest({
  variant,
  emoji,
  label,
  uitleg,
}: {
  variant: "bigdaddy" | "piet" | "pias";
  emoji: string;
  label: string;
  uitleg: string;
}) {
  return (
    <button
      type="button"
      className={`hero-crest hero-crest--${variant}`}
      aria-label={`${label}: ${uitleg}`}
    >
      <span className="hero-crest__icon" aria-hidden="true">
        {emoji}
      </span>
      <span className="hero-crest__label">{label}</span>
      <span className="hero-crest__tip" role="tooltip" aria-hidden="true">
        <span className="hero-crest__tip-label">{label}</span>
        <span className="hero-crest__tip-text">{uitleg}</span>
      </span>
    </button>
  );
}
