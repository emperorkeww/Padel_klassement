// Wat een speelvorm gaat opleveren, in woorden en getallen (#1089).
//
// De speelformaat-kaart belooft drie dingen vóór je op de knop drukt: hoeveel
// spelers, hoeveel banen en hoeveel rondes. Die getallen moeten kloppen met wat
// de generator daarna écht doet, anders is de kaart een folder. Vandaar dat ze
// hier uit dezelfde rekensom komen als `americanoRound` (banen = spelers / 4,
// de rest zit een ronde op de bank) in plaats van uit een eigen formule.

export type Speelvorm = "eerlijk" | "americano" | "mexicano";

/** Grenzen van de rondekeuze. Tien is gelijk aan de winner-card bij het
 *  aanmaken van een speeldag (#727), zodat dezelfde keuze overal hetzelfde
 *  bereik heeft. */
export const RONDES_MIN = 1;
export const RONDES_MAX = 10;

/** Houdt een gestapte of ingetypte waarde binnen het bereik. */
export function klemRondes(aantal: number): number {
  if (!Number.isFinite(aantal)) return RONDES_MIN;
  return Math.min(RONDES_MAX, Math.max(RONDES_MIN, Math.round(aantal)));
}

/** Volle banen bij dit aantal aanwezigen — vier spelers per baan. */
export function banen(aanwezig: number): number {
  return Math.floor(aanwezig / 4);
}

/** Spelers die deze ronde op de bank zitten (aantal niet deelbaar door vier). */
export function reserves(aanwezig: number): number {
  return aanwezig % 4;
}

/**
 * Het aantal rondes dat de knop nu echt aanmaakt.
 *
 * Eerlijk en Americano kennen een keuze: allebei kunnen ze een hele avond in
 * één tik neerzetten, elke ronde met een eigen verdeling. Mexicano niet — die
 * deelt per ronde in op de laatste stand en heeft de uitslagen van de vorige
 * ronde dus nodig.
 *
 * Eerlijk kon dat tot #1141 niet, terwijl de knop op de speeldagkaart het wél
 * deed. Die knop is weg; deze keuze neemt het over.
 */
export function rondes(vorm: Speelvorm, aantalRondes: number): number {
  return vorm === "mexicano" ? 1 : aantalRondes;
}

export function beschrijving(vorm: Speelvorm, aanwezig: number): string {
  const b = banen(aanwezig);
  const baanTekst = b === 1 ? "één baan" : `${b} banen`;
  switch (vorm) {
    case "eerlijk":
      return `Verdeelt de ${aanwezig} aanwezige spelers over ${baanTekst} in teams met een zo gelijk mogelijke rating. Je ziet de winstkans voordat je de baan op gaat.`;
    case "americano":
      return `Iedereen speelt met en tegen iedereen, elke ronde met een nieuwe partner. ${aanwezig} spelers over ${baanTekst}; punten tellen individueel.`;
    case "mexicano":
      return "Zoals Americano, maar de indeling volgt per ronde de tussenstand: nummer 1 speelt met nummer 4 tegen 2 en 3.";
  }
}

/**
 * Wat de knop gaat doen. Bij meer dan één ronde staat het aantal in het label.
 * De handoff schrijft kaal "Start Americano" voor, maar dan zegt niets je dat
 * je op het punt staat vijf rondes tegelijk weg te schrijven — en dat is nu
 * juist waar de keuze ernaast over gaat.
 */
export function ctaLabel(vorm: Speelvorm, aantalRondes = RONDES_MIN): string {
  switch (vorm) {
    case "eerlijk":
      return aantalRondes > 1
        ? `Stel ${aantalRondes} eerlijke rondes voor`
        : "Stel eerlijke teams voor";
    case "americano":
      return aantalRondes > 1
        ? `Start ${aantalRondes} Americano-rondes`
        : "Start Americano";
    case "mexicano":
      return "Start Mexicano";
  }
}
