// Wat een speelvorm gaat opleveren, in woorden en getallen (#1089).
//
// De speelformaat-kaart belooft drie dingen vóór je op de knop drukt: hoeveel
// spelers, hoeveel banen en hoeveel rondes. Die getallen moeten kloppen met wat
// de generator daarna écht doet, anders is de kaart een folder. Vandaar dat ze
// hier uit dezelfde rekensom komen als `americanoRound` (banen = spelers / 4,
// de rest zit een ronde op de bank) in plaats van uit een eigen formule.

export type Speelvorm = "eerlijk" | "americano" | "mexicano";

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
 * Alleen Americano kent een keuze (de generator draait de rotatie zo vaak als
 * je vraagt); Mexicano deelt per ronde in op de laatste stand en kan er dus
 * maar één tegelijk, en Eerlijk zet één ronde vaste teams neer.
 */
export function rondes(vorm: Speelvorm, americanoRondes: number): number {
  return vorm === "americano" ? americanoRondes : 1;
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

export function ctaLabel(vorm: Speelvorm): string {
  switch (vorm) {
    case "eerlijk":
      return "Stel eerlijke teams voor";
    case "americano":
      return "Start Americano";
    case "mexicano":
      return "Start Mexicano";
  }
}
