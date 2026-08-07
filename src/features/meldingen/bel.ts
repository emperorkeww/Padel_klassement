import { aantalTekst } from "@/lib/utils/format";

/** Boven dit aantal wordt de teller "9+": drie cijfers passen niet in een badge
 *  van 18px, en het verschil tussen 12 en 30 verandert toch niets aan wat je
 *  doet. */
export const MAX_TELLER = 9;

/**
 * De toegankelijke naam van de meldingen-ingang, op mobiel én desktop.
 *
 * De teller staat hier voluit en niet als los cijfer in de DOM: "3" naast een
 * bel is voor wie luistert net zoveel als niets. Null = nog onbekend, en dan
 * belooft het label ook niets.
 */
export function belLabel(ongelezen: number | null): string {
  if (ongelezen == null) return "Meldingen";
  return `Meldingen, ${aantalTekst(ongelezen, "ongelezen melding", "ongelezen meldingen")}`;
}

/** Wat er in de badge komt te staan. Alleen voor het oog — aria-hidden. */
export function tellerTekst(ongelezen: number): string {
  return ongelezen > MAX_TELLER ? `${MAX_TELLER}+` : String(ongelezen);
}
