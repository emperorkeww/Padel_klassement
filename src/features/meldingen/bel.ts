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
 *
 * Openstaande vriendschapsverzoeken (#1232) worden apart genoemd en niet bij de
 * ongelezen meldingen opgeteld: het zijn twee verschillende dingen — het ene
 * telt wat je nog niet zág, het andere wat nog op een antwoord wacht. De stip
 * op de knop is kleur; deze naam draagt de betekenis (#924).
 */
export function belLabel(ongelezen: number | null, verzoeken = 0): string {
  const wacht =
    verzoeken > 0
      ? ` — ${aantalTekst(verzoeken, "vriendschapsverzoek", "vriendschapsverzoeken")} ${verzoeken === 1 ? "wacht" : "wachten"} op je`
      : "";
  if (ongelezen == null) return `Meldingen${wacht}`;
  return `Meldingen, ${aantalTekst(ongelezen, "ongelezen melding", "ongelezen meldingen")}${wacht}`;
}

/** Wat er in de badge komt te staan. Alleen voor het oog — aria-hidden. */
export function tellerTekst(ongelezen: number): string {
  return ongelezen > MAX_TELLER ? `${MAX_TELLER}+` : String(ongelezen);
}
