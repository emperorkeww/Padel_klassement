import { Link } from "react-router-dom";
import type { Match, Profile, Team } from "../../lib/types";
import { formatSetScores, readSetScores, teamLabel } from "./api";
import { formatRelativeDay } from "../../lib/format";
import { outcomeFor } from "../../lib/results";
import { Avatar } from "../../components/Avatar";

/** Eén match als kaart: teams met avatars links/rechts, score in het midden.
 *  Met `perspectiveId` kleurt de kaart mee met winst/verlies van die speler. */
export function MatchCard({
  match: m,
  teams,
  profiles,
  perspectiveId,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  perspectiveId?: string;
}) {
  const done = m.status === "completed";
  const aWon = done && m.winner_team_id === m.team_a_id;
  const bWon = done && m.winner_team_id === m.team_b_id;
  const drew = done && m.winner_team_id === null;
  const scored = m.score_a != null && m.score_b != null;
  const setLine = formatSetScores(readSetScores(m));

  const outcome = perspectiveId ? outcomeFor(m, teams, perspectiveId) : null;
  const outcomeClass =
    outcome === "W"
      ? "match-card--win"
      : outcome === "L"
        ? "match-card--loss"
        : outcome === "D"
          ? "match-card--draw"
          : "";

  return (
    <Link className={`match-card ${outcomeClass}`} to={`/matches/${m.id}`}>
      <TeamSide team={teams[m.team_a_id]} profiles={profiles} won={aWon} />
      <span className="match-card__mid">
        <span className="match-card__score">
          {scored ? `${m.score_a}–${m.score_b}` : done ? "gespeeld" : "vs"}
        </span>
        <span className="match-card__meta">
          {drew
            ? "gelijkspel"
            : done
              ? formatRelativeDay(m.played_at ?? m.created_at) || "afgerond"
              : m.round_number != null
                ? `ronde ${m.round_number} · gepland`
                : "gepland"}
        </span>
        {setLine && (
          <span className="match-card__meta match-card__sets">{setLine}</span>
        )}
      </span>
      <TeamSide
        team={teams[m.team_b_id]}
        profiles={profiles}
        won={bWon}
        right
      />
    </Link>
  );
}

export function TeamSide({
  team,
  profiles,
  won,
  right = false,
}: {
  team: Team | undefined;
  profiles: Record<string, Profile>;
  won: boolean;
  right?: boolean;
}) {
  const players = team
    ? [profiles[team.player1_id], profiles[team.player2_id]]
    : [];
  return (
    <span
      className={`match-card__side ${right ? "match-card__side--right" : ""} ${won ? "is-win" : ""}`}
    >
      <span className="avatar-pair">
        {players.map((p, i) => (
          <Avatar key={p?.id ?? i} profile={p} size={26} short />
        ))}
      </span>
      <span className="match-card__names">
        {team ? (
          players.map((p, i) => (
            <span key={p?.id ?? i}>
              {won && i === 0 && <span aria-label="winnaar">🏆 </span>}
              {p?.full_name?.trim() || p?.username || "Onbekend"}
            </span>
          ))
        ) : (
          <span>{teamLabel(team, profiles)}</span>
        )}
      </span>
    </span>
  );
}

export function MatchList({
  matches,
  teams,
  profiles,
  empty = "Nog geen matches.",
  perspectiveId,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  empty?: string;
  perspectiveId?: string;
}) {
  if (matches.length === 0) return <p className="empty">{empty}</p>;

  return (
    <ul className="matchlist">
      {matches.map((m) => (
        <li key={m.id}>
          <MatchCard
            match={m}
            teams={teams}
            profiles={profiles}
            perspectiveId={perspectiveId}
          />
        </li>
      ))}
    </ul>
  );
}

export default MatchList;