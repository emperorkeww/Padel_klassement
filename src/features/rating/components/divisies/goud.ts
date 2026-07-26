// Divisiekaart "Wannabe" (goud) — 1000–1099 — crème emaille, champagnefolie, imitatiegoud.
//
// Nog niet uitgewerkt (#710): zonder `register` blijft deze divisie op de
// generieke metaalladder van `kaartSkin`, en zonder ornamentdelen tekent de
// kaart precies zoals voorheen. Vul dit bestand met het kleurregister, de
// gradient-definities en de ornamentdelen; `divisieKaart.ts` beschrijft het
// contract, en de bijbehorende CSS staat in goud.css.

import type { DivisieKaart } from "./divisieKaart";

export const DIVISIE_GOUD: DivisieKaart = {
  key: "goud",
  naam: "Wannabe",
};
