// Speciale edities (#497): welke speler draagt welke editie op zijn
// FUT-kaart. Icon = Big Daddy (#1, alleen zonder échte dictator op de
// troon), In-Form = speler van de week (spelerVanDeWeek.ts). Sinds #621
// gedeeld door klassement, profiel en matchdetail: één speler → één kaart.

import { byRank } from "@/features/rating/standings";
import type { PlayerRating, PlayerStanding } from "@/types";
import type { InForm } from "./spelerVanDeWeek";

export type Editie = "icon" | "inform" | null;

/** Welke editie draagt deze speler? Icon (Big Daddy) wint van In-Form. */
export function editieVoor(
  key: string,
  iconKey: string | null,
  inForm: InForm | null,
): Editie {
  if (key === iconKey) return "icon";
  if (key === inForm?.playerId) return "inform";
  return null;
}

/** Wie draagt de Icon-editie (Big Daddy)? De hoogst-geratete speler — in
 *  dezelfde volgorde als het klassement (#52): rating aflopend met de
 *  klassieke punten-tie-break — maar alleen zolang er geen échte dictator in
 *  de stand op De Troon zit (#528: mét dictator begint het volk bij #2,
 *  zonder kroon). Staat de dictator niet (meer) in de stand, dan blijft de
 *  kroon gewoon bij de #1 — zelfde gedrag als splitDictatorThrone. */
export function iconKeyVoor(
  standings: PlayerStanding[],
  ratings: Record<string, PlayerRating>,
  dictatorId: string | null,
): string | null {
  if (dictatorId && standings.some((s) => s.player_id === dictatorId))
    return null;
  const top = [...standings].sort(
    (a, b) =>
      (ratings[b.player_id]?.rating ?? -Infinity) -
        (ratings[a.player_id]?.rating ?? -Infinity) || byRank(a, b),
  )[0];
  return top != null && ratings[top.player_id]?.rating != null
    ? top.player_id
    : null;
}

/** Editie-regel op het kaartvlak, bv. "⚡ In-Form · +48". */
export function editieLabel(
  editie: Editie,
  inForm: InForm | null,
): string | null {
  if (editie === "icon") return "👑 Big Daddy";
  if (editie === "inform")
    return `⚡ In-Form${inForm ? ` · +${inForm.delta}` : ""}`;
  return null;
}
