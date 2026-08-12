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
// mét de divisiepoorten — het beeld dat de losse lanes samen niet geven. Puur
// visueel (aria-hidden); het toegankelijke verhaal staat in de sr-samenvatting
// die RaceLeaderboard ernaast rendert (raceSrSummary).
export function RaceOverview({
  rows,
  axis,
  checkpoints,
}: {
  /** Het volledige veld — dezelfde rijen die de as verankeren. */
  rows: Row[];
  axis: DivisionAxis;
  checkpoints: RaceCheckpoint[];
}) {
  const rated = rows.filter(
    (row): row is Row & { rating: number } => row.rating != null,
  );
  if (rated.length === 0) return null;

  return (
    <div className="race-overview" aria-hidden="true">
      <span className="race-axis__spacer" />
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
          />
        ))}
        {rated.map((row) => {
          const tier = tierFor(row.rating);
          return (
            <span
              key={row.key}
              className={`race-overview__punt${tier ? ` tier-badge--${tier.key}` : ""}${
                row.isMe ? " is-me" : ""
              }`}
              style={
                {
                  "--race-x": `${calculateRacePosition(row.rating, axis)}%`,
                } as RaceStyle
              }
            />
          );
        })}
      </div>
    </div>
  );
}
