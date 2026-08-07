/**
 * De verwachte winkans als één gedeelde balk tussen de twee teamrijen: één
 * feit, één balk (#941). De kans komt uit `winChance` in features/rating/elo.ts
 * — dezelfde Elo als de databank-trigger.
 *
 * Uitgesneden uit PlannedMatchCard in #1144; klassen bewust ongewijzigd, de
 * styling staat nog in PlannedMatchCard.css.
 */
export function MatchProbability({
  pctA,
  labelA,
  labelB,
}: {
  /** Winkans van team A in hele procenten; null = geen ratings, geen balk. */
  pctA: number | null;
  labelA: string;
  labelB: string;
}) {
  if (pctA == null) return null;
  return (
    <div
      className="planned-card__prob"
      role="img"
      aria-label={`Verwachte winkans: ${labelA} ${pctA}%, ${labelB} ${100 - pctA}%`}
      title="Verwachte winkans op basis van de huidige ratings"
    >
      <span className={`planned-card__prob-pct${pctA >= 50 ? " is-fav" : ""}`}>
        {pctA}%
      </span>
      <span className="planned-card__prob-track">
        <span
          className="planned-card__prob-fill"
          style={{ width: `${pctA}%` }}
        />
      </span>
      <span className={`planned-card__prob-pct${pctA < 50 ? " is-fav" : ""}`}>
        {100 - pctA}%
      </span>
    </div>
  );
}

export default MatchProbability;
