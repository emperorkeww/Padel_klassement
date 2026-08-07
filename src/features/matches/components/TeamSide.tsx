import type { PlayerRating, Profile, Team } from "@/types";
import { teamLabel } from "@/features/matches/api";
import { playersOf } from "@/features/rating/results";
import { Avatar } from "@/ui/Avatar";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { THIN_GAMES } from "@/features/groups/groupRating";

/**
 * Eén kant van een match: avatars + namen van het team, optioneel met de
 * divisiebadge per speler.
 *
 * Stond tot #1144 in MatchList.tsx, maar wordt door vier schermen gebruikt
 * (matchlijst, geplande kaart, dashboard, groepsronde) en hoort dus niet in het
 * bestand van één van die vier. Puur presentationeel — alle data komt via props.
 */
export function TeamSide({
  team,
  profiles,
  won,
  right = false,
  ratings,
}: {
  team: Team | undefined;
  profiles: Record<string, Profile>;
  won: boolean;
  right?: boolean;
  /** Optioneel: toont per speler de divisie-badge (#127). Alleen kaarten die
   *  de ratings toch al laden (PlannedMatchCard) geven dit mee. */
  ratings?: Record<string, PlayerRating>;
}) {
  // Singles (1v1) toont één avatar/naam; "Onbekend" blijft enkel voor
  // spelers van wie het profiel (nog) niet geladen is.
  const playerIds = playersOf(team);
  const players = playerIds.map((pid) => profiles[pid]);
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
              {ratings && (
                <>
                  {" "}
                  <TierBadge
                    rating={ratings[playerIds[i]]?.rating ?? null}
                    dimmed={
                      (ratings[playerIds[i]]?.games ?? 0) > 0 &&
                      (ratings[playerIds[i]]?.games ?? 0) < THIN_GAMES
                    }
                    size="sm"
                  />
                </>
              )}
            </span>
          ))
        ) : (
          <span>{teamLabel(team, profiles)}</span>
        )}
      </span>
    </span>
  );
}

export default TeamSide;
