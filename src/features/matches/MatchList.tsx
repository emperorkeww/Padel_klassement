import { Link } from "react-router-dom";
import type { Match, Profile, Team } from "../../lib/types";
import { teamLabel } from "./api";
import { formatDate } from "../../lib/format";

export function MatchList({
  matches,
  teams,
  profiles,
  empty = "Nog geen matches.",
}: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  empty?: string;
}) {
  if (matches.length === 0) return <p className="empty">{empty}</p>;

  return (
    <ul className="matchlist">
      {matches.map((m) => {
        const aWon = m.winner_team_id === m.team_a_id;
        const bWon = m.winner_team_id === m.team_b_id;
        const done = m.status === "completed";
        const drew = done && m.winner_team_id === null;
        const scored = m.score_a != null && m.score_b != null;
        return (
          <li key={m.id}>
            <Link className="matchlist__item" to={`/matches/${m.id}`}>
              <span className="matchlist__teams">
                <span className={`matchlist__team ${done && aWon ? "is-win" : ""}`}>
                  {teamLabel(teams[m.team_a_id], profiles)}
                </span>
                <span className="matchlist__vs">
                  {scored ? `${m.score_a}–${m.score_b}` : "vs"}
                </span>
                <span className={`matchlist__team ${done && bWon ? "is-win" : ""}`}>
                  {teamLabel(teams[m.team_b_id], profiles)}
                </span>
              </span>
              <span className="matchlist__meta">
                {drew && <span className="badge">gelijk</span>}
                {m.round_number != null && (
                  <span className="badge">ronde {m.round_number}</span>
                )}
                <span className="badge">
                  {done
                    ? formatDate(m.played_at ?? m.created_at) || "afgerond"
                    : "gepland"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default MatchList;
