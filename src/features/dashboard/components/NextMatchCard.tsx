import { Link } from "react-router-dom";
import { TeamSide } from "@/features/matches/components/MatchList";
import type { Match, Profile, Team } from "@/types";
import { matchWhen } from "../dashboardHelpers";

// De eerstvolgende te spelen match, compact op het overzicht (#273): wie +
// wanneer, en één tik naar de match zelf voor de uitslag — de score-invoer
// hoort daar, niet op de startpagina (zeker niet op mobiel).

export function NextMatchCard({
  match,
  groupName,
  teams,
  profiles,
}: {
  match: Match;
  groupName: string | null;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
}) {
  return (
    <section className="card card--next">
      <div className="card__head">
        <h2 className="card__title">Jouw volgende match</h2>
        <Link className="profile-link" to={`/matches/${match.id}`}>
          Invullen →
        </Link>
      </div>
      <Link
        className="next-match"
        to={`/matches/${match.id}`}
        aria-label={`Volgende match — ${matchWhen(match, groupName)}`}
      >
        <div className="match-card">
          <TeamSide team={teams[match.team_a_id]} profiles={profiles} won={false} />
          <span className="match-card__mid">
            <span className="match-card__meta">{matchWhen(match, groupName)}</span>
          </span>
          <TeamSide
            team={teams[match.team_b_id]}
            profiles={profiles}
            won={false}
            right
          />
        </div>
      </Link>
    </section>
  );
}

export default NextMatchCard;
