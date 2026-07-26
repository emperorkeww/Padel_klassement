// Registry van de negen basisdivisies (#710). Eén plek waar FutKaart.tsx en
// futKaartCanvas.ts hun divisiekaart opzoeken; een divisie zonder register of
// ornamenten valt terug op de generieke metaalladder, dus deze tabel mag
// gedeeltelijk gevuld zijn.

import type { TierKey } from "@/features/rating/tiers";
import type { DivisieKaart } from "./divisieKaart";
import { DIVISIE_SLOF } from "./slof";
import { DIVISIE_KARTON } from "./karton";
import { DIVISIE_HOUT } from "./hout";
import { DIVISIE_BRONS } from "./brons";
import { DIVISIE_ZILVER } from "./zilver";
import { DIVISIE_GOUD } from "./goud";
import { DIVISIE_PLATINA } from "./platina";
import { DIVISIE_DIAMANT } from "./diamant";
import { DIVISIE_MEESTER } from "./meester";

export const DIVISIE_KAARTEN: readonly DivisieKaart[] = [
  DIVISIE_SLOF,
  DIVISIE_KARTON,
  DIVISIE_HOUT,
  DIVISIE_BRONS,
  DIVISIE_ZILVER,
  DIVISIE_GOUD,
  DIVISIE_PLATINA,
  DIVISIE_DIAMANT,
  DIVISIE_MEESTER,
];

/** De divisiekaart van deze tier, of undefined wanneer de divisie (nog) op de
 *  generieke metaalladder staat. */
export function divisieKaart(key: TierKey | undefined): DivisieKaart | undefined {
  if (!key) return undefined;
  return DIVISIE_KAARTEN.find((d) => d.key === key);
}

/** Heeft deze divisie iets te tekenen in de ornamentlaag? */
export function heeftDivisieOrnament(d: DivisieKaart | undefined): boolean {
  return !!d && ((d.achter?.length ?? 0) > 0 || (d.voor?.length ?? 0) > 0);
}
