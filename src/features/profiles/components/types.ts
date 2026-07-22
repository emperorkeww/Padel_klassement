import type { ComponentProps } from "react";
import type { Profile, Team, Match } from "@/types";
import type { Outcome } from "@/features/rating/results";
import type { Badge } from "@/features/profiles/badges";
import type { TierProgress } from "@/features/rating/tiers";
import type { Regeerduur } from "@/features/standings/dictatorApi";
import type { Editie } from "@/features/standings/edities";
import type { Upset } from "@/features/matches/upset";
import type { Season } from "@/features/rating/seasons";
import type { RatingChart } from "@/features/rating/components/RatingChart";
import type { RankChart } from "@/features/rating/components/RankChart";

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
  /** Zit deze speler nú op De Troon (El Padelissimo, #545)? Alleen dan toont de
   *  tier-badge de dictator-tier; anders wordt 1600+ naar GOAT geklemd. */
  isDictator: boolean;
  /** Regeerduur-samenvatting (#545); null als de speler nooit dictator was. */
  regeerduur: Regeerduur | null;
  /** Speciale editie op de hero-kaart (#497/#621): Icon (Big Daddy) of
   *  In-Form (speler van de week) — dezelfde regels als het klassement,
   *  zodat één speler overal dezelfde kaart draagt. Optioneel zodat een
   *  halfgevulde ProfileData (tests) zonder editie blijft werken. */
  editie?: Editie;
  /** Editie-regel op het kaartvlak, bv. "⚡ In-Form · +48". */
  editieTekst?: string | null;

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
  /** Tegenstanders met een actieve vendetta tegen deze speler (#169). */
  vendettaMet: Set<string>;

  // Onderling (ingelogde gebruiker vs. deze speler)
  balans: Balans | null;
  vsGespeeld: number;
  samenGespeeld: number;
}

export type ProfileTab = "overzicht" | "statistieken" | "badges" | "matches";
