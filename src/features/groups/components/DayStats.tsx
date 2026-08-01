import { useMemo } from "react";
import { Avatar } from "@/ui/Avatar";
import { eveningSummary } from "@/features/feed/eveningSummary";
import { teamLabel } from "@/features/matches/api";
import { displayName } from "@/features/profiles/api";
import { dayMovers } from "@/features/groups/dayOverview";
import type { ZwartePiet } from "@/features/groups/zwartePiet";
import type { Match, Profile, RatingPoint, Team } from "@/types";
import "./DayStats.css";

/** Hoogtepunten van vandaag op de Vandaag-tab (#342): MVP, ELO-bewegers, beste
 *  duo en Zwarte Piet. Rendert niets als er nog niets te vieren valt.
 *
 *  De telling gespeeld/gepland stond hier tot #839. Die zit nu in de dagkop
 *  bovenaan de tab: één stand voor de hele dag, op de plek waar je 'm zoekt,
 *  in plaats van een tweede telling tien blokken lager. */
export function DayStats({
  matches,
  teams,
  profiles,
  histories,
  zwartePiet,
  today,
  timezone,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  histories: Record<string, RatingPoint[]>;
  zwartePiet: ZwartePiet | null;
  today: string;
  timezone: string;
}) {
  const sum = useMemo(
    () => eveningSummary(matches, teams, today, timezone, histories),
    [matches, teams, today, timezone, histories],
  );
  const movers = useMemo(
    () => dayMovers(histories, new Set(sum.matches.map((m) => m.id))),
    [histories, sum.matches],
  );

  const mvp = sum.rows[0] ?? null;
  const topRise = movers[0] && movers[0].delta > 0 ? movers[0] : null;
  const topDrop =
    movers.length > 0 && movers[movers.length - 1].delta < 0
      ? movers[movers.length - 1]
      : null;

  // Zonder telblok is een kaart zonder hoogtepunten een lege kaart: dan liever
  // niets. Een dag met alleen nog geplande matches staat al in de dagkop.
  if (!mvp && !sum.bestDuo && !topRise && !topDrop && !zwartePiet) return null;

  return (
    <section className="card day-stats">
      <div className="card__head">
        <h2 className="card__title card__title--tight">Hoogtepunten</h2>
      </div>

      <ul className="day-stats__highlights">
        {mvp && (
          <li className="day-stat-line">
            <span className="day-stat-line__icon" aria-hidden="true">
              🥇
            </span>
            <Avatar profile={profiles[mvp.playerId]} size={26} />
            <span className="day-stat-line__label">
              MVP · <strong>{displayName(profiles[mvp.playerId])}</strong>
            </span>
            <span className="day-stat-line__meta">
              {mvp.won}W · {mvp.points} ptn
            </span>
          </li>
        )}

        {topRise && (
          <li className="day-stat-line">
            <span className="day-stat-line__icon" aria-hidden="true">
              📈
            </span>
            <Avatar profile={profiles[topRise.playerId]} size={26} />
            <span className="day-stat-line__label">
              Grootste stijger ·{" "}
              <strong>{displayName(profiles[topRise.playerId])}</strong>
            </span>
            <span className="day-stat-line__meta is-up">▲{topRise.delta}</span>
          </li>
        )}

        {topDrop && (
          <li className="day-stat-line">
            <span className="day-stat-line__icon" aria-hidden="true">
              📉
            </span>
            <Avatar profile={profiles[topDrop.playerId]} size={26} />
            <span className="day-stat-line__label">
              Grootste daler ·{" "}
              <strong>{displayName(profiles[topDrop.playerId])}</strong>
            </span>
            <span className="day-stat-line__meta is-down">
              ▼{Math.abs(topDrop.delta)}
            </span>
          </li>
        )}

        {sum.bestDuo && (
          <li className="day-stat-line">
            <span className="day-stat-line__icon" aria-hidden="true">
              🏆
            </span>
            <span className="day-stat-line__label">
              Beste duo ·{" "}
              <strong>{teamLabel(teams[sum.bestDuo.teamId], profiles)}</strong>
            </span>
            <span className="day-stat-line__meta">
              {sum.bestDuo.won} winst{sum.bestDuo.won === 1 ? "" : "en"}
            </span>
          </li>
        )}

        {zwartePiet && (
          <li className="day-stat-line">
            <span className="day-stat-line__icon" aria-hidden="true">
              🃏
            </span>
            <Avatar profile={profiles[zwartePiet.holderId]} size={26} />
            <span className="day-stat-line__label">
              Zwarte Piet ·{" "}
              <strong>{displayName(profiles[zwartePiet.holderId])}</strong>
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}

export default DayStats;
