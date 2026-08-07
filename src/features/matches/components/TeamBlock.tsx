import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { displayName } from "@/features/profiles/api";
import { playersOf } from "@/features/rating/results";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { tierChange } from "@/features/rating/tiers";
import type { Profile, RatingPoint, Team } from "@/types";

/**
 * Eén kant van het scorebord op het matchdetail: teamnaam, winnaarschip en per
 * speler zijn Elo na afloop met de mutatie en een eventuele divisiewissel.
 *
 * Uitgesneden uit MatchDetail in #1144. Anders dan `TeamSide` (de compacte
 * variant op de lijstkaart) toont dit blok de ratinggevolgen, en daarom heeft
 * het de rating-historie nodig.
 */
export function TeamBlock({
  team,
  side,
  label,
  profiles,
  won,
  histories,
  matchId,
}: {
  team: Team | undefined;
  /** Kant van het bord: A kleurt smaragd, B lime (zoals bij teams kiezen). */
  side: "a" | "b";
  label: string;
  profiles: Record<string, Profile>;
  won: boolean;
  histories: Record<string, RatingPoint[]> | undefined;
  matchId: string;
}) {
  // Singles (1v1) toont één speler; "Onbekend" blijft enkel voor spelers
  // van wie het profiel (nog) niet geladen is.
  const players = playersOf(team).map((pid) => profiles[pid]);
  return (
    <div className={`md-team md-team--${side} ${won ? "is-win" : ""}`}>
      <div className="md-team__name">
        {label}
        {won && (
          <span className="badge badge--win md-team__winnaar">
            <IconBeker />
            Winnaar
          </span>
        )}
      </div>
      <ul className="md-team__players">
        {players.map((p, i) => {
          if (!p) return <li key={i}>Onbekend</li>;
          const playerHistory = histories?.[p.id];
          const point = playerHistory?.find((h) => h.match_id === matchId);
          const delta = point?.delta;
          const ratingAfter = point?.rating_after;
          const ratingBefore = point?.rating_before;
          const wissel = tierChange(ratingBefore ?? null, ratingAfter ?? null);

          return (
            <li key={p.id} className="md-player">
              <div className="md-player__identity">
                <Avatar profile={p} size={24} />
                <Link className="profile-link" to={`/spelers/${p.id}`}>
                  {displayName(p)}
                </Link>
              </div>
              {point && (
                <div className="md-player__stats">
                  <span className="md-player__rating">{ratingAfter} ELO</span>
                  {delta != null && delta !== 0 && (
                    <span
                      className={`stat__delta ${delta > 0 ? "is-up" : "is-down"}`}
                    >
                      {delta > 0 ? "▲" : "▼"}
                      {Math.abs(delta)}
                    </span>
                  )}
                  <TierBadge rating={ratingAfter ?? null} size="sm" />
                  {wissel && (
                    <span
                      className={`badge md-player__wissel ${wissel.richting === "promotie" ? "badge--win" : "badge--danger"}`}
                    >
                      <IconPijl omhoog={wissel.richting === "promotie"} />
                      {wissel.richting === "promotie"
                        ? "Promotie"
                        : "Degradatie"}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Bekertje bij de winnaarschip (#948) en pijl bij promotie/degradatie: de
 *  chips droegen ⬆️/⬇️ als emoji, en die vallen per platform anders uit — de
 *  rest van de app tekent zijn iconen. */
function IconBeker() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
      <path d="M9 20h6M12 13v7" />
    </svg>
  );
}

function IconPijl({ omhoog }: { omhoog: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={omhoog ? undefined : { transform: "rotate(180deg)" }}
    >
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export default TeamBlock;
