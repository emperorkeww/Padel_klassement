import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** De uitklapper naar de context; het label volgt wat je met de match mag. */
const DETAILS = /^(details|tippen)$/i;
/** De primaire actie die de uitslag-sheet opent. */
const SCORE = /^(uitslag invullen|score invoeren)$/i;

/**
 * Klapt op elke geplande matchkaart de detail-uitklapper open.
 *
 * Daarachter zitten de toto-tegel, het lef- en jokerblok en de coach/rivaliteit-
 * context. Wie die in een test nodig heeft, opent de kaart dus eerst — net als
 * een gebruiker.
 *
 * De uitslag zélf zit er sinds #1144 niet meer achter: die opent in een sheet
 * via de primaire knop. Daarvoor is `openScoreSheets` hieronder.
 */
export async function openPlannedCards() {
  const knoppen = await screen.findAllByRole("button", { name: DETAILS });
  for (const knop of knoppen) await userEvent.click(knop);
  return knoppen.length;
}

/**
 * Opent de uitslag-sheet van elke geplande kaart waar de kijker mag invullen.
 * Losse helper naast `openPlannedCards`: het zijn sinds #1144 twee
 * verschillende dingen, en een test die de score invult heeft de context er
 * meestal niet bij nodig.
 */
export async function openScoreSheets() {
  const knoppen = await screen.findAllByRole("button", { name: SCORE });
  for (const knop of knoppen) await userEvent.click(knop);
  return knoppen.length;
}
