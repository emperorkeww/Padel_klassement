// Divisiekaart "Eeuwige belofte" (diamant) — 1200–1299 — ijsblauw, kobalt en geborsteld aluminium.
//
// Nog niet uitgewerkt (#710): zonder `register` blijft deze divisie op de
// generieke metaalladder van `kaartSkin`, en zonder ornamentdelen tekent de
// kaart precies zoals voorheen. Vul dit bestand met het kleurregister, de
// gradient-definities en de ornamentdelen; `divisieKaart.ts` beschrijft het
// contract, en de bijbehorende CSS staat in diamant.css.

import type { DivisieKaart } from "./divisieKaart";

export const DIVISIE_DIAMANT: DivisieKaart = {
  key: "diamant",
  naam: "Eeuwige belofte",
};
