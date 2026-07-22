// Speciale edities (#497): welke speler draagt welke editie op zijn
// FUT-kaart. Sinds #621 gedeeld door klassement, profiel en matchdetail
// (één speler → één kaart); sinds #625 met een expliciet prioriteitsmodel
// en de Kampioen-editie erbij.
//
// De edities, op prioriteit:
//   icon      👑 Big Daddy — de #1 van het klassement (alleen zonder échte
//              dictator op De Troon).
//   kampioen  🏆 Winnaar van het vorige kwartaal, het hele lopende
//              kwartaal lang (kampioen.ts).
//   inform    ⚡ Speler van de week (spelerVanDeWeek.ts).
//
// Bewuste niet-edities: de zittende dictator draagt nooit een editie — zijn
// troonkaart is al de sterkste special (tier-gedreven, #545); een editie
// erbovenop zou dubbelop zijn. 🤡 Pias en 🔥 On-Fire zijn kandidaten voor
// een vervolgissue (pias is per groep bepaald; een streak-editie vergt
// matchdata die niet overal geladen is).

import { byRank } from "@/features/rating/standings";
import type { PlayerRating, PlayerStanding } from "@/types";
import type { InForm } from "./spelerVanDeWeek";
import type { Kampioen } from "./kampioen";

export type Editie = "icon" | "kampioen" | "inform" | null;

/** Prioriteit: de eerste editie die een speler draagt wint — gerangschikt op
 *  zeldzaamheid en duur. Er is hooguit één Big Daddy (en die is al de kroon),
 *  een kampioenschap duurt een kwartaal, In-Form wisselt wekelijks. */
export const EDITIE_PRIORITEIT = ["icon", "kampioen", "inform"] as const;

/** Alles wat nodig is om de editie van élke speler te bepalen — op alle
 *  plekken identiek opgebouwd, zodat de kaart overal dezelfde is. */
export interface EditieContext {
  /** Zittende dictator (#545): draagt nooit een editie (troonkaart). */
  dictatorId: string | null;
  /** Drager van de Icon-editie (iconKeyVoor), null zonder Big Daddy. */
  iconKey: string | null;
  /** Winnaar van het vorige kwartaal, null zonder kampioen. */
  kampioen: Kampioen | null;
  /** Speler van de week, null zonder (of buiten de live stand). */
  inForm: InForm | null;
}

/** Wie draagt deze editie volgens de context? */
function dragerVan(
  editie: (typeof EDITIE_PRIORITEIT)[number],
  ctx: EditieContext,
): string | null {
  switch (editie) {
    case "icon":
      return ctx.iconKey;
    case "kampioen":
      return ctx.kampioen?.playerId ?? null;
    case "inform":
      return ctx.inForm?.playerId ?? null;
  }
}

/** Welke editie draagt deze speler? De prioriteitslijst beslist; de
 *  zittende dictator valt er altijd buiten. */
export function editieVoor(key: string, ctx: EditieContext): Editie {
  if (ctx.dictatorId && key === ctx.dictatorId) return null;
  for (const editie of EDITIE_PRIORITEIT) {
    const drager = dragerVan(editie, ctx);
    if (drager != null && key === drager) return editie;
  }
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
  ctx: EditieContext,
): string | null {
  if (editie === "icon") return "👑 Big Daddy";
  if (editie === "kampioen")
    return `🏆 Kampioen${ctx.kampioen ? ` ${ctx.kampioen.seasonLabel}` : ""}`;
  if (editie === "inform")
    return `⚡ In-Form${ctx.inForm ? ` · +${ctx.inForm.delta}` : ""}`;
  return null;
}