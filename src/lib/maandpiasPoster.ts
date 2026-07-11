// Inhoud van de Pias-poster (#167): puur datawerk (geen canvas), zodat de
// opbouw los van het tekenen testbaar is — zelfde patroon als championPoster.ts.
// De poster is opzettelijk gênant maar plagerig van toon.

import type { PiasReden } from "./maandpias";

export interface PiasPoster {
  /** Kop, bv. "PIAS VAN DE MAAND". */
  kop: string;
  /** Naam van de ongelukkige. */
  naam: string;
  /** Ludieke omschrijving van de afgang (zonder naam). */
  detail: string;
  /** Bijschrift onderaan, bv. "januari 2026". */
  periodeLabel: string;
}

/** Kort, brutaal onderschrift per reden. */
const ONDERSCHRIFT: Record<PiasReden, string> = {
  afdroging: "Beter volgende keer, kampioen.",
  bagel: "Nul. Nul games. Autsj.",
  "zwarte-reeks": "De reeks die maar niet wilde stoppen.",
  choke: "Papieren favoriet.",
};

/** Onderschrift voor een reden (voor onder de poster). */
export function piasOnderschrift(reden: PiasReden): string {
  return ONDERSCHRIFT[reden];
}

/** Posterinhoud voor de pias. */
export function piasPoster(
  naam: string,
  detail: string,
  periodeLabel: string,
  scope: "week" | "maand",
): PiasPoster {
  return {
    kop: scope === "maand" ? "PIAS VAN DE MAAND" : "PIAS-ALARM",
    naam,
    detail,
    periodeLabel,
  };
}
