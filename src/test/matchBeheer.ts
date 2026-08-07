import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Opent het ⋯-beheermenu van het matchdetail, en desgewenst meteen één actie
 * erin.
 *
 * Beheer zat tot #1144 in een "Beheer & correcties"-inklapper op de pagina
 * zelf; sinds die issue is het één sheet achter ⋯, met de acties die de kijker
 * werkelijk mag. Vandaar twee stappen in plaats van één.
 */
export async function openBeheer(actie?: RegExp) {
  await userEvent.click(
    await screen.findByRole("button", { name: /meer acties/i }),
  );
  if (actie) {
    await userEvent.click(await screen.findByRole("button", { name: actie }));
  }
}
