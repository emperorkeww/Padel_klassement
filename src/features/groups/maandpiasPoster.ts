// Inhoud van de Pias-poster (#167): puur datawerk (geen canvas), zodat de
// opbouw los van het tekenen testbaar is — zelfde patroon als championPoster.ts.
// De poster is opzettelijk gênant maar plagerig van toon.

import { coachSneer, COMMENTATOR, type RoastCtx } from "@/features/coach/roastTone";
import type { PiasReden } from "@/features/groups/maandpias";

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
  afdroging: "Aanwezigheidsprijs voor jou.",
  bagel: "Nul. Nul games. Autsj.",
  "zwarte-reeks": "Verliezen met abonnement.",
  choke: "Papieren favoriet.",
};

/** Onderschrift voor een reden (voor onder de poster). */
export function piasOnderschrift(reden: PiasReden): string {
  return ONDERSCHRIFT[reden];
}

/**
 * Coach Rudy's burn als geattribueerde quote voor op de poster (#202), of null
 * bij roast-schild. Zelfde seed als de kaart → poster en app tonen dezelfde
 * sneer.
 */
export function piasCoachQuote(ctx: RoastCtx, seed: number): string | null {
  const sneer = coachSneer(ctx, seed);
  if (!sneer) return null;
  return `${COMMENTATOR.emoji} ${COMMENTATOR.naam}: “${sneer}”`;
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
