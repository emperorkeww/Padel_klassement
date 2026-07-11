// Uitgelichte kaart met de spannendste rivaliteit van de groep: onderlinge
// stand, laatste ontmoeting en — als er al een nieuwe confrontatie gepland
// staat — een revanche-aankondiging. Alles client-side uit de al geladen
// groepsmatches; zonder rivaliteit boven de duel-drempel rendert de kaart niet.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { formatDate, formatRelativeDay, formatTime } from "../../lib/format";
import { groupRivalries, nextEncounter } from "../../lib/rivalry";
import type { Match, Profile, Team } from "../../lib/types";
import { displayName } from "../profiles/api";
import "./RivalryCard.css";

export function RivalryCard({
  matches,
  teams,
  profiles,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
}) {
  const top = useMemo(
    () => groupRivalries(matches, teams)[0] ?? null,
    [matches, teams],
  );
  const revanche = useMemo(
    () => (top ? nextEncounter(matches, teams, top.a, top.b) : null),
    [matches, teams, top],
  );
  if (!top) return null;

  const lastWinner = top.last.winnerId;
  const lastWhen = formatDate(top.last.match.played_at ?? top.last.match.created_at);
  const revancheWhen = revanche?.played_at
    ? `${formatRelativeDay(revanche.played_at)} om ${formatTime(revanche.played_at)}`
    : null;

  return (
    <section className="card rivalry-card">
      <div className="card__head">
        <h2 className="card__title">🔥 Rivaliteit van de groep</h2>
        {revanche && (
          <span className="badge badge--accent">
            {revancheWhen ? `Revanche ${revancheWhen}!` : "Revanche gepland!"}
          </span>
        )}
      </div>

      <div className="rivalry">
        <Link className="rivalry__player" to={`/spelers/${top.a}`}>
          <Avatar profile={profiles[top.a]} size={40} />
          <span className="rivalry__name">{displayName(profiles[top.a])}</span>
        </Link>
        <span className="rivalry__stand">
          <span className="rivalry__score num">
            {top.winsA}–{top.winsB}
          </span>
          {top.draws > 0 && (
            <span className="rivalry__draws">{top.draws} gelijk</span>
          )}
        </span>
        <Link className="rivalry__player rivalry__player--right" to={`/spelers/${top.b}`}>
          <Avatar profile={profiles[top.b]} size={40} />
          <span className="rivalry__name">{displayName(profiles[top.b])}</span>
        </Link>
      </div>

      <p className="rivalry__meta">
        {top.played} onderlinge duels · laatste {lastWhen}
        {lastWinner
          ? ` — ${displayName(profiles[lastWinner])} won`
          : " — gelijkspel"}
      </p>
    </section>
  );
}

export default RivalryCard;
