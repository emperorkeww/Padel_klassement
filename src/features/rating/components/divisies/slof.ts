// Divisiekaart "Sletje van de baan" (slof) — tot 599 — betongrijs, taupe, dof zink; de eenvoudigste kaart van de ladder.
//
// Nog niet uitgewerkt (#710): zonder `register` blijft deze divisie op de
// generieke metaalladder van `kaartSkin`, en zonder ornamentdelen tekent de
// kaart precies zoals voorheen. Vul dit bestand met het kleurregister, de
// gradient-definities en de ornamentdelen; `divisieKaart.ts` beschrijft het
// contract, en de bijbehorende CSS staat in slof.css.

import type { DivisieKaart } from "./divisieKaart";

export const DIVISIE_SLOF: DivisieKaart = {
  key: "slof",
  naam: "Sletje van de baan",
};
