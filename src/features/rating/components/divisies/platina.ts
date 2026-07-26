// Divisiekaart "Glazenwasser" (platina) — 1100–1199 — frosted aqua glas en geoxideerd aluminium.
//
// Nog niet uitgewerkt (#710): zonder `register` blijft deze divisie op de
// generieke metaalladder van `kaartSkin`, en zonder ornamentdelen tekent de
// kaart precies zoals voorheen. Vul dit bestand met het kleurregister, de
// gradient-definities en de ornamentdelen; `divisieKaart.ts` beschrijft het
// contract, en de bijbehorende CSS staat in platina.css.

import type { DivisieKaart } from "./divisieKaart";

export const DIVISIE_PLATINA: DivisieKaart = {
  key: "platina",
  naam: "Glazenwasser",
};
