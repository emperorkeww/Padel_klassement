import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks/useAsync";
import { Avatar } from "@/ui/Avatar";
import { teamLabel } from "@/features/matches/api";
import { getMatchPredictions } from "@/features/matches/predictionsApi";
import { displayName, getProfilesByIds } from "@/features/profiles/api";
import type { Match, Profile, Team } from "@/types";

/**
 * Toto (#116) op het matchdetail: wie tipte welk team, en na de uitslag wie er
 * juist zat en hoeveel punten dat opleverde. Verbergt zichzelf zolang er geen
 * tips zijn.
 *
 * Uitgesneden uit MatchDetail in #1144, gedrag ongewijzigd.
 */
export function TotoSection({
  match: m,
  teams,
  teamProfiles,
}: {
  match: Match;
  teams: Record<string, Team>;
  /** Profielen van de vier spelers (voor de teamlabels). */
  teamProfiles: Record<string, Profile>;
}) {
  const predictions = useAsync(() => getMatchPredictions(m.id), [m.id]);
  const preds = predictions.data ?? [];
  // Tippers kunnen ook groepsleden buiten de match zijn: hun profielen apart.
  const tipperIds = preds.map((p) => p.player_id);
  const tipperKey = tipperIds.join(",");
  const tippers = useAsync(() => getProfilesByIds(tipperIds), [tipperKey]);
  if (preds.length === 0) return null;

  const pmap = tippers.data ?? {};
  const done = m.status === "completed";
  const isDraw = done && m.winner_team_id === null;
  // Juiste tips (meeste punten) bovenaan; daarna op naam.
  const sorted = [...preds].sort(
    (a, b) =>
      (b.points ?? -1) - (a.points ?? -1) ||
      displayName(pmap[a.player_id]).localeCompare(
        displayName(pmap[b.player_id]),
      ),
  );

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">🎯 Toto</h2>
      </div>
      {isDraw && (
        <p className="md-toto__note">Gelijkspel — niemand krijgt punten.</p>
      )}
      <ul className="md-toto">
        {sorted.map((p) => {
          const profile = pmap[p.player_id];
          const correct = p.points != null && p.points > 0;
          return (
            <li key={p.player_id} className="md-toto__row">
              <Avatar profile={profile} size={24} />
              {profile ? (
                <Link className="profile-link" to={`/spelers/${p.player_id}`}>
                  {displayName(profile)}
                </Link>
              ) : (
                <span>Onbekend</span>
              )}
              <span className="md-toto__pick">
                tipte {teamLabel(teams[p.predicted_team_id], teamProfiles)}
              </span>
              {p.points != null && (
                <span className={`badge ${correct ? "badge--win" : ""}`}>
                  {correct ? `juist · +${p.points} pt` : "mis · 0 pt"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!done && (
        <p className="md-toto__note">
          Tippen kan tot de starttijd; punten volgen na de uitslag.
        </p>
      )}
    </section>
  );
}

export default TotoSection;
