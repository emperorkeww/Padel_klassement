import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { teamLabel } from "@/features/matches/api";
import { displayName } from "@/features/profiles/api";
import { eveningSummary } from "@/features/feed/eveningSummary";
import { ShareEvening } from "@/features/groups/components/ShareEvening";
import type { GroupSummary } from "@/features/groups/api";
import type { RoastIntensiteit } from "@/types";
import type { Match, Profile, RatingPoint, Team } from "@/types";
import type { deriveEvening } from "../dashboardHelpers";

// Speelavond-terugblik op het overzicht: podium, beste duo en de grootste upset
// van de laatste speeldag. Uit Dashboard.tsx gelicht (#736).
//
// De rating-historie is optioneel: die komt pas na de uitslagen binnen (hij
// wordt alléén voor deze kaart opgehaald), en zonder historie valt enkel de
// upset-regel weg.

const MEDAILLES = ["🥇", "🥈", "🥉"];

export function EveningCard({
  evening,
  groups,
  completed,
  teams,
  profiles,
  histories,
  intensiteit,
  timezone,
}: {
  evening: NonNullable<ReturnType<typeof deriveEvening>>;
  groups: GroupSummary[];
  /** Alle afgeronde matches uit het recente venster. */
  completed: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  histories: Record<string, RatingPoint[]> | undefined;
  intensiteit: RoastIntensiteit;
  timezone: string;
}) {
  const group = groups.find((g) => g.id === evening.groupId);
  const matches = completed.filter((m) => m.group_id === evening.groupId);
  const summary = eveningSummary(matches, teams, evening.day, timezone, histories);
  if (!group || !summary) return null;

  return (
    <section className="card card--evening">
      <div className="card__head">
        <h2 className="card__title">
          Speelavond {evening.isToday ? "vandaag" : "gisteren"}
        </h2>
        <Link className="profile-link" to={`/groepen/${evening.groupId}`}>
          Bekijk →
        </Link>
      </div>
      <p className="evening__sub">
        <strong>{group.name}</strong>
        <span className="evening__dot" aria-hidden="true">
          ·
        </span>
        {evening.count} {evening.count === 1 ? "uitslag" : "uitslagen"}
      </p>

      {summary.rows.length > 0 && (
        <ol className="evening-podium">
          {summary.rows.slice(0, 3).map((row, i) => (
            <li key={row.playerId} className="evening-podium__row">
              <span
                className="evening-podium__rank"
                data-rank={i + 1}
                aria-label={`${i + 1}e`}
              >
                {MEDAILLES[i]}
              </span>
              <Avatar profile={profiles[row.playerId]} size={30} />
              <span className="evening-podium__name">
                {displayName(profiles[row.playerId])}
              </span>
              <span className="evening-podium__form" aria-hidden="true">
                <span className="evening-podium__wl">{row.won}W</span>
                {row.drawn > 0 && (
                  <span className="evening-podium__wl">{row.drawn}G</span>
                )}
                <span className="evening-podium__wl">{row.lost}V</span>
              </span>
              <span className="evening-podium__pts">
                <strong>{row.points}</strong> ptn
              </span>
            </li>
          ))}
        </ol>
      )}

      {summary.bestDuo && (
        <p className="evening__duo">
          <span aria-hidden="true">🏆</span> Beste duo:{" "}
          <strong>{teamLabel(teams[summary.bestDuo.teamId], profiles)}</strong>{" "}
          ({summary.bestDuo.won} winst
          {summary.bestDuo.won === 1 ? "" : "en"})
        </p>
      )}

      {summary.biggestUpset && (
        <p className="evening__upset">
          <span aria-hidden="true">🎯</span> Grootste upset:{" "}
          <strong>
            {teamLabel(teams[summary.biggestUpset.winnerTeamId], profiles)}
          </strong>{" "}
          ({Math.round(summary.biggestUpset.chance * 100)}% kans)
        </p>
      )}

      {evening.isToday && (
        <div className="evening__actions">
          <ShareEvening
            groupId={group.id}
            groupName={group.name}
            matches={matches}
            teams={teams}
            profiles={profiles}
            histories={histories}
            intensiteit={intensiteit}
            timezone={timezone}
          />
        </div>
      )}
    </section>
  );
}

export default EveningCard;
