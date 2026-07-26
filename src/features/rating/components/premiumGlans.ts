/** Premium glans (#773): de gedeelde infrastructuur achter het ingebouwde
 *  lichtgedrag van Big Daddy, de Kampioen, de GOAT en El Padelissimo.
 *
 *  Deze vier zijn permanente kaartvarianten — hun glans hoort bij de kaart zelf,
 *  anders dan In-Form en On Fire, die tijdelijke statusoverlays zijn. Eén
 *  infrastructuur, vier modi: de CSS-varianten hangen aan de bestaande
 *  kaartklassen en verschillen alleen in tokens (baan, hoek, duur, kracht, hart),
 *  zodat er geen vier losse animatiesystemen ontstaan.
 *
 *  Eigen module en niet in FutKaart.tsx: dat bestand exporteert componenten, en
 *  een gemengde export breekt fast refresh in dev.
 *
 *  Zie het blok "Premium glans (#773)" onderaan FutKaart.css voor de vier modi. */

export type GlansVariant = "bigdaddy" | "kampioen" | "dictator" | "goat";

/** Twee tabellen omdat Big Daddy en de Kampioen edities zijn en de GOAT en
 *  El Padelissimo toptiers. De editie wint van het tier — dezelfde cascade als
 *  bij het ornament. */
const EDITIE_GLANS: Record<string, GlansVariant | undefined> = {
  icon: "bigdaddy",
  kampioen: "kampioen",
};
const TIER_GLANS: Record<string, GlansVariant | undefined> = {
  legende: "goat",
  dictator: "dictator",
};

/** De tijdelijke overlays die visuele voorrang hebben. */
const TIJDELIJKE_OVERLAY = new Set(["inform", "onfire"]);

/** Welke glans een kaart krijgt, en of die gedempt moet staan.
 *
 *  `gedempt` betekent: de laag blijft staan met zijn statische highlight, maar
 *  zonder beweging. Dat is het geval zodra een tijdelijke overlay actief is —
 *  twee zware animaties over elkaar is precies wat de issue wil voorkomen, en de
 *  statuslogica zelf verandert hier niet: dit is uitsluitend visuele compositie. */
export function premiumGlans(
  editie: string | null | undefined,
  tierKey: string | null | undefined,
): { variant: GlansVariant | null; gedempt: boolean } {
  const variant =
    EDITIE_GLANS[editie ?? ""] ?? TIER_GLANS[tierKey ?? ""] ?? null;
  return { variant, gedempt: TIJDELIJKE_OVERLAY.has(editie ?? "") };
}

/** Deterministische startvertraging uit een stabiel zaad (speler-key).
 *
 *  Zonder dit starten alle kaarten in een raster op dezelfde frame en knippert
 *  het hele scherm synchroon. Deterministisch en niet random, zodat een herrender
 *  de animatie niet laat verspringen. Bereik 0–2399 ms: ruim binnen de kortste
 *  cyclus (Big Daddy, 7s), dus de vertraging schuift de fase op zonder een kaart
 *  merkbaar lang stil te zetten. */
export function glansVertraging(zaad: string | undefined): number {
  if (!zaad) return 0;
  let h = 0;
  for (let i = 0; i < zaad.length; i += 1) {
    h = (h * 31 + zaad.charCodeAt(i)) % 1000003;
  }
  return h % 2400;
}
