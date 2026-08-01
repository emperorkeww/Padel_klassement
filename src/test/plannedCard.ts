import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** De knoppen die een geplande matchkaart openen; het label volgt wat je met
 *  de match mag (invullen, tippen of alleen kijken). Een kaart die al openstaat
 *  draagt "Inklappen" en valt hier dus vanzelf buiten. */
const UITKLAP = /^(uitslag invullen|tippen|details)$/i;

/**
 * Klapt elke geplande matchkaart op het scherm open (#941).
 *
 * De score-steppers, de sets, de toto-tegel, het lef-blok en de coach-context
 * zitten sinds die issue achter één knop: uitgeklapt is zo'n kaart ~800px hoog
 * en was een lijst met geplande matches niet meer te overzien. Wie in een test
 * het invulformulier nodig heeft, opent de kaart dus eerst — net als een
 * gebruiker.
 */
export async function openPlannedCards() {
  const knoppen = await screen.findAllByRole("button", { name: UITKLAP });
  for (const knop of knoppen) await userEvent.click(knop);
  return knoppen.length;
}
