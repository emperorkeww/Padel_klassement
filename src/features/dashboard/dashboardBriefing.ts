import { coachBriefing } from "@/features/coach/coachMoments";
import { klassementFeiten } from "@/features/coach/klassementFeiten";
import { verliesreeksTegen } from "@/features/coach/coachStats";
import { inTeam } from "@/features/rating/results";
import { displayName } from "@/features/profiles/api";
import type { Badge } from "@/features/profiles/badges";
import type { Match, PlayerRating, PlayerStanding, Profile, Team } from "@/types";
import type { Rival } from "./dashboardHelpers";

// Coach Rudy's ochtendpraatje op het overzicht (#213): één regel over vandaag,
// gevoed door je reeks, positie en volgende match. Het dashboard is persoonlijk
// (niet groep-gescoopt), dus het volgt jóuw profiel-intensiteit (#183) — net als
// de feed — en respecteert je roast-schild. De klassement-feiten (#411) geven de
// briefing zijn positie-tier: troon, jager, middenmoot, kelder of nieuw.
//
// Stond als 70 regels afleiding midden in Dashboard.tsx (#736); hier is het te
// testen zonder het hele scherm te renderen.

export type BriefingInput = {
  myId: string;
  /** Mijn rij in het klassement; zonder rij geen briefing. */
  me: PlayerStanding | undefined;
  profile: Profile | undefined;
  rank: number | null;
  streak: number;
  losing: number;
  vorm: ("W" | "D" | "L")[];
  dayDelta: number;
  /** Mijn matches (voor de onderlinge verliesreeks tegen de rivaal). */
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  ratings: Record<string, PlayerRating>;
  /** Klassement op Elo gesorteerd — de volgorde die de feiten gebruiken. */
  eloRanked: PlayerStanding[];
  nextMatch: Match | null;
  rival: Rival | null;
  nextBadge: Badge | null;
  /** Datumdeel van de seed, zodat de regel een dag lang stabiel blijft. */
  vandaag: string;
};

/** De briefing-regel, of null als er (nog) geen klassementsrij is. */
export function dashboardBriefing(input: BriefingInput): string | null {
  const {
    myId, me, profile, rank, streak, losing, vorm, dayDelta,
    matches, teams, profiles, ratings, eloRanked, nextMatch, rival,
    nextBadge, vandaag,
  } = input;
  if (!me) return null;

  // #579 — persoonlijke feiten uit al geladen data. Speel je je volgende match
  // tegen je vaste rivaal, mét een lopende onderlinge verliesreeks?
  const rivaalMatch = (() => {
    if (!rival || !nextMatch) return null;
    const mijnA = inTeam(teams[nextMatch.team_a_id], myId);
    const mijnB = inTeam(teams[nextMatch.team_b_id], myId);
    const tegenTeam = mijnA
      ? teams[nextMatch.team_b_id]
      : mijnB
        ? teams[nextMatch.team_a_id]
        : undefined;
    if (!tegenTeam || !inTeam(tegenTeam, rival.oppId)) return null;
    const verliesreeks = verliesreeksTegen(matches, teams, myId, rival.oppId, nextMatch);
    if (verliesreeks < 2) return null;
    return { naam: displayName(profiles[rival.oppId]), verliesreeks };
  })();

  // Badge op een haar na klaar.
  const badgeNabij = nextBadge?.voortgang
    ? {
        naam: nextBadge.naam,
        emoji: nextBadge.emoji,
        nu: nextBadge.voortgang.nu,
        doel: nextBadge.voortgang.doel,
      }
    : null;

  return coachBriefing({
    rank,
    streak,
    losing,
    heeftMatch: !!nextMatch,
    rivaalMatch,
    dayDelta,
    vorm,
    badgeNabij,
    klassement: klassementFeiten(
      eloRanked.map((p) => ({
        playerId: p.player_id,
        naam: displayName(profiles[p.player_id] ?? p),
        rating: ratings[p.player_id]?.rating ?? null,
        games: ratings[p.player_id]?.games ?? 0,
      })),
      myId,
      "globaal",
    ),
    seed: `${myId}-${vandaag}`,
    ctx: {
      intensiteit: profile?.roast_intensiteit ?? "radioactief",
      schild: profile?.roast_schild ?? false,
    },
  });
}
