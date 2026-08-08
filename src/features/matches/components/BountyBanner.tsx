import { useAsync } from "@/lib/hooks/useAsync";
import { displayName } from "@/features/profiles/api";
import { BOUNTY_EMOJI, matchBounties } from "@/features/rating/bounty";
import { getActiveBounties } from "@/features/standings/bountyApi";
import type { Match, Profile, Team } from "@/types";
import "./BountyBanner.css";

/** Bounty-banner (#805) op een geplande match: staat er een leider op het veld,
 *  dan hoort iedereen vóór de aftrap te weten wat er te halen valt.
 *
 *  Alleen op nog te spelen matches: daarna vertelt de feed wie de reeks brak en
 *  hoeveel het opleverde, en zou een "op het spel"-banner een leugen zijn. */
export function BountyBanner({
  match: m,
  teams,
  profiles,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
}) {
  const bounties = useAsync(getActiveBounties, []);
  if (m.status !== "scheduled") return null;

  const dragers = matchBounties(bounties.data ?? [], m, teams);
  if (dragers.length === 0) return null;

  // Zelfde afspraak als BountyMark: een pool van 0 is geen bounty (#1168).
  const hoogste = Math.max(...dragers.map((d) => d.pool));
  if (hoogste <= 0) return null;

  const namen = dragers
    .map((d) => `${displayName(profiles[d.playerId])} (${d.pool})`)
    .join(" · ");

  return (
    <p className="bounty-banner">
      <span className="bounty-banner__tok" aria-hidden="true">
        {BOUNTY_EMOJI}
      </span>
      <span>
        <strong>Bounty actief: +{hoogste} Elo op het spel.</strong> Versla{" "}
        {namen} en jullie delen de buit.
      </span>
    </p>
  );
}