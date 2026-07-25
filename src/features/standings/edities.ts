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
//   onfire    🔥 Actieve winstreak van ≥ ONFIRE_DREMPEL (onFire.ts, #632) —
//              ná In-Form: wie beide verdient, draagt de weeklens. Anders dan
//              de rest kan deze editie meerdere dragers tegelijk hebben.
//   pias      🤡 De anti-MVP van de week (#631/#643: bagel, afdroging,
//              zwarte reeks of choke — zelfde regels als bepaalPias), over
//              alle groepen heen — achteraan: een schand-editie verdringt
//              nooit een verdiende. Heet op de kaart "Pias van de club"
//              (#655), zodat de club-brede editie niet verwart met de
//              groeps-"Pias van de week" van banner en dashboard.
//   piet      🃏 De Zwarte Piet (#645/#185): het rondgaande schande-token,
//              over alle groepen heen — helemaal achteraan: binnen de
//              schande wint de weeklens (pias) van het lopende token,
//              dezelfde parallel als inform › onfire. Draagt de overname-
//              datum als suffix ("🃏 Piet sinds 3/7"), sinds #665 met een
//              ingekorte titel om op de veldmaat te passen — zie pietDatum.
//
// Scoping van de pias (#631) en de Piet (#645, zelfde bewuste keuze): beide
// zijn per gróep vastgelegd (pias_of_week resp. zwarte_piet), maar de kaart
// is overal globaal (#621/#624). Client-side scopen ("de groep van de
// kijker", of "alleen als hij in precies één groep pias/Piet is") zou de
// kaart per kijker anders maken: RLS toont iedereen alleen zijn eigen
// groepen, dus zelfs "eenduidigheid" is een gezichtspunt, geen feit. Daarom
// beslist de server: get_global_pias geeft per week de per-groep-pias met de
// hoogste ernst, get_global_zwarte_piet de per-groep-drager met de hoogste
// ernst (tie-break: oudste since) — die zijn per definitie ook pias/Piet van
// hun eigen groep, dus kaart en groepsweergave spreken elkaar nooit tegen.
// Omgekeerd kan een groeps-pias de kaart-editie mislopen (een andere groep
// had een nog gênantere afgang); daarom heet de editie sinds #655 "Pias van
// de club" en legt editieUitleg dat op de kaart zelf uit — net als, sinds
// #665, wat de kale datum van de Piet betekent.
// Anders dan de pias kent de Piet geen weekvenster: het token is tijdloos,
// tot verlossing. Draagt de pias of de Piet een roast-schild (#183), dan
// zwijgt de kaart en schuift er níemand door — de drager blijft de drager,
// alleen de kaart houdt z'n mond (isDrager geeft false i.p.v. een vervanger).
//
// On-Fire (#632) telt niet op échte uitslagen maar op delta > 0 uit de
// rating-histories — de enige streak-bron die overal al geladen is. De reeks
// kan daardoor één afwijken van winStreak (results.ts); drempel en
// benadering staan gedocumenteerd in onFire.ts.
//
// Bewuste niet-edities: de zittende dictator draagt nooit een editie — zijn
// troonkaart is al de sterkste special (tier-gedreven, #545); een editie
// erbovenop zou dubbelop zijn.

import { byRank } from "@/features/rating/standings";
import type { PlayerRating, PlayerStanding } from "@/types";
import type { InForm } from "./spelerVanDeWeek";
import type { Kampioen } from "./kampioen";
import type { GlobalePias } from "./pias";
import type { GlobaleZwartePiet } from "@/features/groups/zwartePiet";

export type Editie =
  | "icon"
  | "kampioen"
  | "inform"
  | "onfire"
  | "pias"
  | "piet"
  | null;

/** Prioriteit: de eerste editie die een speler draagt wint — gerangschikt op
 *  zeldzaamheid en duur. Er is hooguit één Big Daddy (en die is al de kroon),
 *  een kampioenschap duurt een kwartaal, In-Form wisselt wekelijks, On-Fire
 *  komt daarna (de weeklens wint van de reeks, #632), en de schande sluit
 *  achteraan de rij: schande verdringt nooit verdienste. Binnen de schande
 *  wint de pias (de afgang van déze week) van de Piet (het lopende token,
 *  #645) — dezelfde weeklens-boven-reeks-parallel als inform › onfire. */
export const EDITIE_PRIORITEIT = [
  "icon",
  "kampioen",
  "inform",
  "onfire",
  "pias",
  "piet",
] as const;

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
  /** Actieve winstreak per speler (onFireSpelers, #632) — de enige editie
   *  met mogelijk meerdere dragers tegelijk; leeg buiten de live stand. */
  onFire: Record<string, number>;
  /** Globale pias van de lopende (anders vorige) week, null zonder choke of
   *  buiten de live stand; bij een roast-schild (beschermd) zwijgt de kaart. */
  pias: GlobalePias | null;
  /** Globale Zwarte Piet (#645), null als de Piet overal vrij is of buiten
   *  de live stand; bij een roast-schild (beschermd) zwijgt de kaart. */
  piet: GlobaleZwartePiet | null;
}

/** Draagt deze speler deze editie volgens de context? Per speler i.p.v.
 *  per editie ("wie is de drager?"), omdat On-Fire (#632) als enige meerdere
 *  dragers tegelijk kan hebben. */
function isDrager(
  editie: (typeof EDITIE_PRIORITEIT)[number],
  key: string,
  ctx: EditieContext,
): boolean {
  switch (editie) {
    case "icon":
      return ctx.iconKey === key;
    case "kampioen":
      return ctx.kampioen?.playerId === key;
    case "inform":
      return ctx.inForm?.playerId === key;
    case "onfire":
      return ctx.onFire[key] != null;
    case "pias":
      // Roast-schild (#183): geen editie én geen doorschuiving — de kaart
      // zwijgt, maar de pias blijft de pias.
      return ctx.pias != null && !ctx.pias.beschermd && ctx.pias.playerId === key;
    case "piet":
      // Zelfde roast-schild-gedrag als de pias (#645).
      return ctx.piet != null && !ctx.piet.beschermd && ctx.piet.playerId === key;
  }
}

/** Welke editie draagt deze speler? De prioriteitslijst beslist; de
 *  zittende dictator valt er altijd buiten. */
export function editieVoor(key: string, ctx: EditieContext): Editie {
  if (ctx.dictatorId && key === ctx.dictatorId) return null;
  for (const editie of EDITIE_PRIORITEIT) {
    if (isDrager(editie, key, ctx)) return editie;
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

/** Editie-regel op het kaartvlak, bv. "⚡ In-Form · +48". De `key` is nodig
 *  voor On-Fire (#632): de streaklengte is per speler. */
export function editieLabel(
  editie: Editie,
  ctx: EditieContext,
  key?: string,
): string | null {
  if (editie === "icon") return "👑 Big Daddy";
  if (editie === "kampioen")
    return `🏆 Kampioen${ctx.kampioen ? ` ${ctx.kampioen.seasonLabel}` : ""}`;
  if (editie === "inform")
    return `⚡ In-Form${ctx.inForm ? ` · +${ctx.inForm.delta}` : ""}`;
  if (editie === "onfire") {
    const streak = key != null ? ctx.onFire[key] : undefined;
    return `🔥 On Fire${streak != null ? ` · ${streak} op rij` : ""}`;
  }
  // #654: mét reden-suffix vervangt het getal de kwalificatie — "🤡 Pias ·
  // −12 games" i.p.v. het op kleine kaarten afgekapte "🤡 Pias van de club ·
  // −12 games". Alleen de defensieve terugval zónder reden houdt de volle
  // titel (#655: "van de club" i.p.v. "van de week"); zo blijft élke variant
  // hooguit zo lang als "🔥 On Fire · 6 op rij", die op alle kaartmaten past.
  if (editie === "pias")
    return ctx.pias ? `🤡 Pias${piasSuffix(ctx.pias)}` : "🤡 Pias van de club";
  // #665: zelfde ingreep als hierboven voor de pias — mét datum kort de titel
  // in tot "Piet", zónder blijft de volle naam staan.
  if (editie === "piet")
    return ctx.piet ? `🃏 Piet · ${pietDatum(ctx.piet)}` : "🃏 Zwarte Piet";
  return null;
}

/** Tooltip bij de editie-regel (#655). Alleen de twee schand-edities hebben er
 *  een. De club-pias: het label lijkt op de groeps-"Pias van de week" (banner,
 *  dashboard-crest), maar de kaart-editie is club-breed — dat verschil moet de
 *  UI zelf uitleggen. De Piet (#665): op de kaart staat hij als "Piet" met een
 *  datum — de tooltip geeft de volle naam en wat er op die datum gebeurde. De
 *  overige edities spreken voor zich.
 *
 *  Bewust statisch (geen EditieContext-parameter): twee van de vijf
 *  aanroepplekken — VersusKaarten (VsKaart uit compare.ts) en ProfileHero —
 *  krijgen alleen een voorgekookt editielabel en hebben geen ctx bij de hand.
 *  De exacte datum staat al op de kaart; de tooltip hoeft 'm niet te herhalen. */
export function editieUitleg(editie: Editie): string | null {
  if (editie === "pias")
    return "De gênantste afgang van de hele club deze week — per definitie ook de pias van zijn eigen groep, maar niet elke groeps-pias is de club-pias.";
  if (editie === "piet")
    return "Draagt de Zwarte Piet, het rondgaande schande-token van de club, sinds die speeldag — tot hij zich vrijspeelt met een overwinning.";
  return null;
}

/** Speeldatum van de overname-match, kort als d/m (#645): het reden-specifieke
 *  getal van de Piet is hoe lang hij 'm al meedraagt.
 *
 *  #665 — de maatvoering achter "🃏 Piet · 28/12", gemeten in de dev-showcase
 *  op de veldmaat (96px) met de langste datum. Het editie-vak is daar 70px,
 *  maar de échte ruimte is smaller: de regel staat op ~85% hoogte en dáár
 *  knijpt de schildclip het vlak al tot ~66px. "🃏 Zwarte Piet · sinds 28/12"
 *  ging daar ruim overheen, en ook enkel "sinds" schrappen (76,7px) of enkel
 *  de titel inkorten tot "🃏 Piet sinds 28/12" (65,8px, tot op de diagonaal)
 *  liet niets over. CSS-ruimte is er niet meer: #664 zit al op de
 *  leesbaarheidsbodem van 6,5px en tracking 0,03em. Dus allebei — dezelfde
 *  ingreep als #654 bij de pias (mét waarde vervalt de kwalificatie) plús de
 *  suffix-grammatica van de andere edities. Resultaat: 46,5px, ruim binnen de
 *  schildpunt, tegen 66,3px voor "🤡 Pias · −12 games". Wat de datum betékent
 *  staat in de tooltip (editieUitleg).
 *
 *  Niet gekozen: dagen-gedragen ("12d") — semantisch mooier, maar dat maakt
 *  editieLabel klok-afhankelijk (nu puur, zonder Date-injectie getest) en
 *  geeft de kaart elke dag een ander label. */
function pietDatum(piet: GlobaleZwartePiet): string {
  const [, m, d] = piet.since.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/** Compacte reden-aanduiding voor op het kaartvlak (#643): het getal dat de
 *  afgang samenvat, in de kortst mogelijke vorm. Sinds #654 vervangt de
 *  suffix de kwalificatie "van de week" in editieLabel — samen waren ze te
 *  lang voor de kleine kaartmaten. */
function piasSuffix(pias: GlobalePias | null): string {
  if (!pias) return "";
  switch (pias.reden) {
    case "bagel":
      return pias.waarde === 1 ? " · 🥯" : ` · ${pias.waarde}× 🥯`;
    case "afdroging":
      return ` · −${pias.waarde} games`;
    case "zwarte-reeks":
      return ` · ${pias.waarde}× op rij`;
    case "choke":
      return ` · ${Math.round(pias.waarde * 100)}%`;
  }
}