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
//   pias      🤡 Grootste choke van de week, over alle groepen heen
//              (#631) — achteraan: een schand-editie verdringt nooit een
//              verdiende.
//
// Scoping van de pias (#631, bewuste keuze): de pias is per gróep vastgelegd
// (pias_of_week), maar de kaart is overal globaal (#621/#624). Client-side
// scopen ("de groep van de kijker", of "alleen als hij in precies één groep
// pias is") zou de kaart per kijker anders maken: RLS toont iedereen alleen
// zijn eigen groepen, dus zelfs "eenduidigheid" is een gezichtspunt, geen
// feit. Daarom beslist de server: get_global_pias geeft per week de
// per-groep-pias met de hoogste winkans — die is per definitie ook de pias
// van z'n eigen groep, dus kaart en PiasBanner spreken elkaar nooit tegen.
// Draagt de pias een roast-schild (#183), dan zwijgt de kaart en schuift er
// níemand door — de pias blijft de pias, alleen de kaart houdt z'n mond
// (dragerVan geeft null i.p.v. een vervanger).
//
// Bewuste niet-edities: de zittende dictator draagt nooit een editie — zijn
// troonkaart is al de sterkste special (tier-gedreven, #545); een editie
// erbovenop zou dubbelop zijn. 🔥 On-Fire is kandidaat voor een
// vervolgissue (een streak-editie vergt matchdata die niet overal geladen
// is).

import { byRank } from "@/features/rating/standings";
import type { PlayerRating, PlayerStanding } from "@/types";
import type { InForm } from "./spelerVanDeWeek";
import type { Kampioen } from "./kampioen";
import type { GlobalePias } from "./pias";

export type Editie = "icon" | "kampioen" | "inform" | "pias" | null;

/** Prioriteit: de eerste editie die een speler draagt wint — gerangschikt op
 *  zeldzaamheid en duur. Er is hooguit één Big Daddy (en die is al de kroon),
 *  een kampioenschap duurt een kwartaal, In-Form wisselt wekelijks, en de
 *  pias sluit achteraan de rij: schande verdringt nooit verdienste. */
export const EDITIE_PRIORITEIT = ["icon", "kampioen", "inform", "pias"] as const;

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
  /** Globale pias van de lopende (anders vorige) week, null zonder choke of
   *  buiten de live stand; bij een roast-schild (beschermd) zwijgt de kaart. */
  pias: GlobalePias | null;
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
    case "pias":
      // Roast-schild (#183): geen editie én geen doorschuiving — de kaart
      // zwijgt, maar de pias blijft de pias.
      return ctx.pias && !ctx.pias.beschermd ? ctx.pias.playerId : null;
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
  if (editie === "pias")
    return `🤡 Pias van de week${
      ctx.pias ? ` · ${Math.round(ctx.pias.winChance * 100)}%` : ""
    }`;
  return null;
}