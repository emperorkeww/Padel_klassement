import type { CSSProperties } from "react";
import { tierFor } from "@/features/rating/tiers";
import type { Row } from "../leaderboardHelpers";
import {
  calculateRacePosition,
  type DivisionAxis,
  type RaceCheckpoint,
} from "../raceUtils";

type RaceStyle = CSSProperties & Record<`--${string}`, string | number>;

// De overzichtsstrook (#1241): het hele veld als punten op één gedeelde baan,
// mét de divisiepoorten — het beeld dat de losse lanes samen niet geven. De
// punten en poorten zijn decoratie (het toegankelijke verhaal staat in de
// sr-samenvatting van RaceLeaderboard); alleen de kijker-punt is sinds de
// terugkeer van spring-naar-mij een echte knop.
export function RaceOverview({
  rows,
  axis,
  checkpoints,
  onJumpToMe,
}: {
  /** Het volledige veld — dezelfde rijen die de as verankeren. */
  rows: Row[];
  axis: DivisionAxis;
  checkpoints: RaceCheckpoint[];
  /** Maakt van de kijker-punt een "Spring naar jouw baan"-knop. */
  onJumpToMe?: () => void;
}) {
  const rated = rows.filter(
    (row): row is Row & { rating: number } => row.rating != null,
  );
  if (rated.length === 0) return null;

  return (
    <div className="race-overview">
      <span className="race-axis__spacer" aria-hidden="true" />
      <div className="race-overview__track">
        {checkpoints.map((checkpoint) => (
          <span
            key={checkpoint.naam}
            className={`race-overview__poort tier-badge--${checkpoint.key}`}
            style={
              {
                "--race-x": `${calculateRacePosition(checkpoint.min, axis)}%`,
              } as RaceStyle
            }
            aria-hidden="true"
          />
        ))}
        {rated.map((row) => {
          const tier = tierFor(row.rating);
          const className = `race-overview__punt${tier ? ` tier-badge--${tier.key}` : ""}${
            row.isMe ? " is-me" : ""
          }`;
          const style = {
            "--race-x": `${calculateRacePosition(row.rating, axis)}%`,
          } as RaceStyle;
          return row.isMe && onJumpToMe ? (
            <button
              key={row.key}
              type="button"
              className={className}
              style={style}
              aria-label="Spring naar jouw baan"
              onClick={onJumpToMe}
            />
          ) : (
            <span key={row.key} className={className} style={style} aria-hidden="true" />
          );
        })}
      </div>
    </div>
  );
}
