import type { MouseEvent } from "react";
import type { Profile, RatingPoint } from "@/types";
import { winRate, type Outcome } from "@/features/rating/results";
import type { Shift } from "@/features/rating/rankShift";
import { tierFor } from "@/features/rating/tiers";

/** Rating van een speler zoals die was op (of vóór) een datum, uit de historie
 *  (rating_after van de laatste match ≤ die dag). Null als er niets is. */
export function ratingAsOf(
  history: RatingPoint[] | undefined,
  isoDate: string,
): number | null {
  if (!history || history.length === 0) return null;
  let best: RatingPoint | null = null;
  for (const p of history) {
    if (p.played_at.slice(0, 10) <= isoDate && (!best || p.played_at > best.played_at))
      best = p;
  }
  return best ? best.rating_after : null;
}

export type Row = {
  key: string;
  isMe: boolean;
  name: string;
  profile: Pick<Profile, "username" | "full_name"> & { avatar_url?: string | null } | null;
  link?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalDiff: number;
  rating: number | null;
  /** Aantal matches achter de rating — voor de tier-dimming (#127). */
  games: number;
  history: RatingPoint[];
  form: Outcome[];
  shift?: Shift;
  /** Echte positie in het klassement, meegegeven zodat een naam-filter (#282)
   *  de rangnummers niet hernummert. Valt terug op de index als hij ontbreekt. */
  rank?: number;
};

/** De Troon (#528): splitst een gekwalificeerde dictator-#1 af van de ranglijst.
 *  Een dictator is de bovenste speler wiens rating in de tier `dictator` valt
 *  (1600+, #527); die krijgt een eigen troon en verdwijnt uit podium en tabel,
 *  zodat het volk (`rest`) bij #2 begint. Een gewone #1 zonder dictator-tier
 *  blijft staan (throne = null) en dus gewoon Big Daddy op het podium.
 *  Verwacht `rows` al op rating gesorteerd (hoog → laag). */
export function splitDictatorThrone<T extends { rating: number | null }>(
  rows: T[],
): { throne: T | null; rest: T[] } {
  const top = rows[0];
  if (top && tierFor(top.rating)?.key === "dictator") {
    return { throne: top, rest: rows.slice(1) };
  }
  return { throne: null, rest: rows };
}

/** Zet de view-transition-naam op de avatar van de aangeklikte rij, zodat die
 *  bij het navigeren naar het profiel doorgroeit naar de grote profielfoto. */
export function primeAvatarMorph(e: MouseEvent<HTMLElement>) {
  const avatar = e.currentTarget
    .closest("[data-flip-key]")
    ?.querySelector<HTMLElement>(".avatar");
  if (avatar) avatar.style.viewTransitionName = "player-avatar";
}

export type SortKey = "points" | "rating" | "winrate" | "saldo";
export type SortState = { key: SortKey; dir: "asc" | "desc" };

/** Sorteerwaarde per kolom; ontbrekende waarden zakken naar onderen. */
export function sortValue(r: Row, key: SortKey): number {
  switch (key) {
    case "points":
      return r.points;
    case "rating":
      return r.rating ?? Number.NEGATIVE_INFINITY;
    case "winrate":
      return winRate(r.won, r.played) ?? Number.NEGATIVE_INFINITY;
    case "saldo":
      return r.goalDiff;
  }
}
