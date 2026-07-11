import type { ComponentProps } from "react";
import type { Profile, Team, Match } from "../../../lib/types";
import type { Outcome } from "../../../lib/results";
import type { Badge } from "../../../lib/badges";
import type { TierProgress } from "../../../lib/tiers";
import type { Upset } from "../../../lib/upset";
import type { Season } from "../../../lib/seasons";
import type { RatingChart } from "../../../components/RatingChart";
import type { RankChart } from "../../../components/RankChart";

// Eén rij in de onderlinge stand (tegen één tegenstander).
export interface H2HRow {
  oppId: string;
  won: number;
  lost: number;
  drawn: number;
  played: number;
}

export interface PartnerInfo {
  partnerId: string;
  samen: number;
  gewonnen: number;
}

export interface Balans {
  alsTegenstanders: { gewonnen: number; verloren: number; gespeeld: number };
  alsPartners: { samen: number; gewonnen: number };
}

// Serverstand voor deze speler (all-time totalen). Alleen de gebruikte velden.
export interface StandingLite {
  points: number;
  won: number;
  played: number;
}

// Alle afgeleide profielgegevens, één keer berekend in de parent en verdeeld
// over de tab-panelen. De panelen zijn puur: ze rekenen niets zwaars meer zelf.
export interface ProfileData {
  id: string;
  p: Profile;
  isMe: boolean;
  /** Ludieke bijnaam (#167), deterministisch op het speler-id. */
  nick: string;
  /** Eén rake plaag-observatie (#167), of null als er niets te roasten valt. */
  roast: string | null;

  // Kerncijfers
  s: StandingLite | null;
  myRating: number | null;
  thinRating: boolean;
  rank: number | null;
  rate: number | null;
  playedCount: number;
  ratingDelta: number | null;
  form: Outcome[];
  streak: number;
  best: number;
  bigWin: { match: Match; margin: number } | null;
  partner: PartnerInfo | null;
  tierVoortgang: TierProgress | null;
  nextBadge: Badge | null;

  // Grafieken
  hasRating: boolean;
  hasRank: boolean;
  rhist: ComponentProps<typeof RatingChart>["history"];
  rankPoints: ComponentProps<typeof RankChart>["points"];

  // Matches (gescoopt op seizoen)
  scoped: Match[];
  tmap: Record<string, Team>;
  pmap: Record<string, Profile>;
  upsets: Map<string, Upset>;
  season: Season | null;
  matchesLoading: boolean;
  matchesError: string | null;

  // Badges
  badges: Badge[];
  featuredBadges: Badge[];
  featuredIds: string[];
  earnedAllTime: Set<string>;

  // Onderlinge stand
  h2h: H2HRow[];
  nemesis: H2HRow | null;
  favoriet: H2HRow | null;

  // Onderling (ingelogde gebruiker vs. deze speler)
  balans: Balans | null;
  vsGespeeld: number;
  samenGespeeld: number;
}

export type ProfileTab = "overzicht" | "statistieken" | "badges" | "matches";
