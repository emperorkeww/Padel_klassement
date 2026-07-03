import { useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { fairTeams, type FairTeam } from "../../lib/fairTeams";
import { tap } from "../../lib/haptics";
import { getPlayerRatings } from "../standings/ratingsApi";
import { displayName } from "../profiles/api";
import type { Profile } from "../../lib/types";

// "Eerlijke teams" — stelt uit de aanwezigen van de speeldag teams voor met
// een zo klein mogelijk ratingverschil per baan, met de verwachte winstkans
// volgens dezelfde Elo als de winstkans op geplande matches.

export function FairTeamsCard({
  playerIds,
  profiles,
}: {
  /** Spelers die "ja" zeiden voor de gekozen speeldag. */
  playerIds: string[];
  profiles: Record<string, Profile>;
}) {
  const ratings = useAsync(getPlayerRatings, []);
  // null = nog geen voorstel; 0 = eerlijkst, 1 = op één na eerlijkst, …
  const [variant, setVariant] = useState<number | null>(null);

  const enough = playerIds.length >= 4;
  const proposal =
    variant !== null && enough && ratings.data
      ? fairTeams(playerIds, ratings.data, variant)
      : null;

  const names = (team: FairTeam) =>
    team.playerIds.map((id) => displayName(profiles[id])).join(" & ");

  return (
    <section className="card">
      <h2 className="card__title card__title--tight">Eerlijke teams</h2>
      <p className="card__subtitle">
        Verdeelt de aanwezige spelers per baan in teams met een zo gelijk
        mogelijke rating.
      </p>

      <div className="fair-teams__actions">
        <button
          className="btn btn--primary"
          disabled={!enough || !ratings.data}
          onClick={() => {
            tap();
            setVariant(0);
          }}
        >
          Stel eerlijke teams voor
        </button>
        {proposal && (
          <button
            className="btn"
            title="Toon de op één na eerlijkste verdeling"
            onClick={() => setVariant((v) => ((v ?? 0) + 1) % 3)}
          >
            Opnieuw
          </button>
        )}
      </div>

      {!enough && (
        <p className="empty">
          Minimaal 4 aanwezigen nodig om teams voor te stellen.
        </p>
      )}

      {proposal && (
        <div className="fair-teams__result">
          {proposal.courts.map((court, i) => {
            const pctA = Math.round(court.chanceA * 100);
            return (
              <div key={court.teamA.playerIds.join("-")} className="fair-court">
                <span className="fair-court__label">Baan {i + 1}</span>
                <span className="fair-court__teams">
                  <span className="fair-court__team">
                    {names(court.teamA)}{" "}
                    <span className="fair-court__pct">({pctA}%)</span>
                  </span>
                  <span className="fair-court__vs">vs</span>
                  <span className="fair-court__team">
                    {names(court.teamB)}{" "}
                    <span className="fair-court__pct">({100 - pctA}%)</span>
                  </span>
                </span>
              </div>
            );
          })}
          {proposal.reserves.length > 0 && (
            <p className="fair-teams__reserves">
              Reserve{proposal.reserves.length === 1 ? "" : "s"}:{" "}
              {proposal.reserves.map((id) => displayName(profiles[id])).join(", ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default FairTeamsCard;
