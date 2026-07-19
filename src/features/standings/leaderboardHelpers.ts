import type { MouseEvent } from "react";
import type { Profile, RatingPoint } from "@/types";
import { winRate, type Outcome } from "@/features/rating/results";
import type { Shift } from "@/features/rating/rankShift";

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

/** De Troon (#528 + machtsbehoud #545): tilt de zittende dictator uit de
 *  ranglijst. Wie de troon houdt is server-side bepaald (`dictator_termijnen`,
 *  een chronologische replay met machtsbehoud), niet meer de toevallige #1 met
 *  1600+ uit de rating-snapshot. We trekken dus de rij met `key === dictatorKey`
 *  eruit; die krijgt een eigen troon en verdwijnt uit podium en tabel, zodat het
 *  volk (`rest`) bij #2 begint. Is de troon vacant (`dictatorKey` null) of staat
 *  de dictator niet in deze (gefilterde) lijst, dan blijft alles staan
 *  (throne = null) en valt de UI terug op de waarnemend dictator (#530). */
export function splitDictatorThrone<T extends { key: string }>(
  rows: T[],
  dictatorKey: string | null,
): { throne: T | null; rest: T[] } {
  if (!dictatorKey) return { throne: null, rest: rows };
  const idx = rows.findIndex((r) => r.key === dictatorKey);
  if (idx < 0) return { throne: null, rest: rows };
  return { throne: rows[idx], rest: rows.filter((_, i) => i !== idx) };
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
