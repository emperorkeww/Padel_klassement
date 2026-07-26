import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { displayName } from "@/features/profiles/api";
import type { Badge } from "@/features/profiles/badges";
import type { Match, Profile, Team } from "@/types";
import { rivalVerdict, rivalVerdictLabel, type Rival } from "../dashboardHelpers";
import { WeekMissions } from "./WeekMissions";

// Overige gamification samengevouwen (#276): weekmissies, badge-voortgang en
// rivaal — bereikbaar, maar niet langer concurrerend met de kern. De
// rating/divisie blijft zichtbaar want dát is de kern-gamification.

export function DashExtras({
  myId,
  matches,
  teams,
  profiles,
  badges,
  nextBadge,
  rival,
}: {
  myId: string;
  /** Mijn matches; null zolang ze laden. */
  matches: Match[] | null;
  teams: Record<string, Team> | null;
  profiles: Record<string, Profile>;
  badges: Badge[];
  nextBadge: Badge | null;
  rival: Rival | null;
}) {
  const behaald = badges.filter((b) => b.behaald).length;
  const toonBadge = !!(nextBadge && nextBadge.voortgang);
  if (!((matches && teams) || toonBadge || rival)) return null;

  return (
    <details className="dash-extras">
      <summary className="dash-extras__summary">
        <span className="dash-extras__title">Jouw spel &amp; stats</span>
        <span className="dash-extras__hint">weekmissies · badges · rivaal</span>
      </summary>
      <div className="dash-extras__body">
        {matches && teams && (
          <WeekMissions matches={matches} teams={teams} myId={myId} />
        )}

        {nextBadge && nextBadge.voortgang && (
          <section className="card next-badge">
            <div className="card__head">
              <h2 className="card__title">Volgende badge</h2>
              <Link className="profile-link" to={`/spelers/${myId}`}>
                Alle badges →
              </Link>
            </div>
            <p className="next-badge__tally">
              {behaald} van {badges.length} badges behaald
            </p>
            <div className="next-badge__row">
              <span className="next-badge__emoji" aria-hidden="true">
                {nextBadge.emoji}
              </span>
              <span className="next-badge__body">
                <span className="next-badge__name">{nextBadge.naam}</span>
                <span className="next-badge__hint">{nextBadge.omschrijving}</span>
              </span>
              <span
                className="next-badge__count"
                title={`Voortgang voor deze badge: ${nextBadge.voortgang.nu} van ${nextBadge.voortgang.doel}`}
              >
                {nextBadge.voortgang.nu}/{nextBadge.voortgang.doel}
              </span>
            </div>
            <div
              className="next-badge__bar"
              role="progressbar"
              aria-valuenow={nextBadge.voortgang.nu}
              aria-valuemin={0}
              aria-valuemax={nextBadge.voortgang.doel}
            >
              <span
                className="next-badge__fill"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (nextBadge.voortgang.nu / nextBadge.voortgang.doel) * 100,
                    ),
                  )}%`,
                }}
              />
            </div>
          </section>
        )}

        {rival && (
          <section className="card rival-card">
            <div className="card__head">
              <h2 className="card__title">Aartsrivaal ⚔️</h2>
              <Link className="profile-link" to={`/spelers/${rival.oppId}`}>
                Profiel →
              </Link>
            </div>
            <div className="rival">
              <Avatar profile={profiles[rival.oppId]} size={40} />
              <span className="rival__body">
                <Link
                  className="profile-link rival__name"
                  to={`/spelers/${rival.oppId}`}
                >
                  {displayName(profiles[rival.oppId])}
                </Link>
                <span className="rival__meta">
                  {rival.rec.played} duels · {rival.rec.won}–{rival.rec.lost}
                  {rival.rec.drawn > 0 && ` · ${rival.rec.drawn} gelijk`}
                </span>
              </span>
              <span
                className={`rival__verdict rival__verdict--${rivalVerdict(rival.rec)}`}
              >
                {rivalVerdictLabel(rival.rec)}
              </span>
            </div>
          </section>
        )}
      </div>
    </details>
  );
}

export default DashExtras;
