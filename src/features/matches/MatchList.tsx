import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Match, Profile, Team } from "../../lib/types";
import { deleteMatch, formatSetScores, readSetScores, teamLabel } from "./api";
import { formatRelativeDay } from "../../lib/format";
import { outcomeFor } from "../../lib/results";
import { Avatar } from "../../components/Avatar";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { tap } from "../../lib/haptics";

/** Grace-window waarin een verwijderde match nog teruggehaald kan worden. */
const UNDO_MS = 5000;

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

/** MatchCard met een verwijder-knop (aanmaker of groepseigenaar). Na klik een
 *  korte undo-strook zodat een vergissing teruggedraaid kan worden. */
export function DeletableMatchCard({
  match: m,
  teams,
  profiles,
  perspectiveId,
  canManage = false,
  onDeleted,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  perspectiveId?: string;
  /** True voor de groepseigenaar: mag ook matches van anderen verwijderen. */
  canManage?: boolean;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canDelete = !!user && (m.created_by === user.id || canManage);

  function startDelete() {
    setPending(true);
    timer.current = setTimeout(async () => {
      try {
        await deleteMatch(m.id);
        tap();
        onDeleted();
      } catch (err) {
        setPending(false); // niets verwijderd; kaart komt terug
        toast.error(errorMessage(err));
      }
    }, UNDO_MS);
  }

  function undoDelete() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPending(false);
  }

  if (pending) {
    return (
      <div className="match-card__undo" role="status">
        <span>Match verwijderd.</span>
        <button className="btn btn--sm" onClick={undoDelete}>
          Ongedaan maken
        </button>
      </div>
    );
  }

  if (!canDelete) {
    return (
      <MatchCard
        match={m}
        teams={teams}
        profiles={profiles}
        perspectiveId={perspectiveId}
      />
    );
  }

  return (
    <div className="match-card-wrap">
      <MatchCard
        match={m}
        teams={teams}
        profiles={profiles}
        perspectiveId={perspectiveId}
      />
      <button
        type="button"
        className="match-card__del"
        aria-label="Match verwijderen"
        title="Match verwijderen"
        onClick={startDelete}
      >
        🗑
      </button>
    </div>
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