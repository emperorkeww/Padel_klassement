// De Schandpaal (#682): de tegenhanger van De Troon (#528/#545) onderaan het
// klassement. Dit bestand is de énige bron van waarheid voor "wie staat er aan
// de schandpaal", zodat de kaart en de 🤡-FUT-editie (#631) elkaar per
// constructie niet kunnen tegenspreken: beide vertrekken van de globale pias
// (get_global_pias → currentPias) en beide vallen dicht bij een roast-schild.
//
// Bewust géén hoofdgetal, dus ook geen rating/delta in deze selectie: de pias
// is niet de laagste van het klassement maar de gênantste van de week, en de
// `waarde` uit pias_of_week wisselt van eenheid per reden (bagels, games,
// reekslengte, winkans-%). De reden-regel uit piasDetail draagt de kaart alleen.
//
// Randgeval, bewust: is de zittende dictator óók de globale pias, dan staat hij
// boven én onder het volk. De FUT-kaart onderdrukt de editie voor de dictator
// (editieVoor: zijn troonkaart is al de sterkste special), maar dat is een
// regel over de kaartskin, niet over de aanduiding — de sandwich mag hier
// gewoon over dezelfde man gaan.

import { piasDetail, type PiasReden } from "@/features/groups/maandpias";
import { roastCtx, roastSeed, type RoastCtx } from "@/features/coach/roastTone";
import { displayName } from "@/features/profiles/api";
import { currentPias } from "@/features/standings/pias";
import type { GlobalePias } from "@/features/standings/pias";
import type { Profile } from "@/types";

/** Alles wat de Schandpaal-kaart nodig heeft. Null-return betekent: geen
 *  sectie, niet "een lege sectie". */
export interface SchandpaalData {
  playerId: string;
  naam: string;
  profile: Profile | null;
  /** Waarom hij aan de schandpaal staat, als één afgeronde regel. */
  detail: string;
  reden: PiasReden;
  /** Maandag van de ISO-week (YYYY-MM-DD) — voedt de weekregel op de kaart,
   *  want currentPias valt terug op vorige week als deze nog leeg is. */
  weekStart: string;
  isMe: boolean;
  link: string;
  /** Coach Rudy's sneer onder de kaart: club-brede scope, dus geen groeps-
   *  intensiteit — de standaardtoon ('gemeen'). */
  ctx: RoastCtx;
  seed: number;
}

/**
 * De pias van de lopende (anders vorige) week als kaartgegevens, of null.
 *
 * Null bij een leeg venster (geen enkele globale pias-rij) en bij een
 * roast-schild — fail-closed op twee bronnen: `beschermd` uit
 * get_global_pias (server-side autoritair, ook voor profielen die de kijker
 * niet mag zien) én `roast_schild` op het profiel zelf. Zegt één van de twee
 * "beschermd", dan verdwijnt de hele sectie: geen uitvergroting, geen sneer.
 */
export function schandpaalUit(
  rows: GlobalePias[],
  profiles: Record<string, Profile>,
  myId: string | null,
  now?: Date,
): SchandpaalData | null {
  const pias = currentPias(rows, now);
  if (!pias || pias.beschermd) return null;
  const profile = profiles[pias.playerId] ?? null;
  if (profile?.roast_schild) return null;
  return {
    playerId: pias.playerId,
    naam: displayName(profile),
    profile,
    detail: piasDetail(pias.reden, pias.waarde),
    reden: pias.reden,
    weekStart: pias.weekStart,
    isMe: myId != null && pias.playerId === myId,
    link: `/spelers/${pias.playerId}`,
    ctx: roastCtx(null, profile),
    seed: roastSeed(pias.playerId, pias.weekStart),
  };
}
