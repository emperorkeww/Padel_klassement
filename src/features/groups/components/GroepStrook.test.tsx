import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroepStrook } from "./GroepStrook";
import type { GroupSummary } from "../api";

const groepen = [
  { id: "g1", name: "Vrijdagavond", member_ids: ["a", "b"] },
  { id: "g2", name: "Dinsdaggroep", member_ids: ["a"] },
] as unknown as GroupSummary[];

function toon(gekozen = "") {
  const onKies = vi.fn();
  const onNieuw = vi.fn();
  render(
    <GroepStrook
      groepen={groepen}
      gekozen={gekozen}
      onKies={onKies}
      onNieuw={onNieuw}
    />,
  );
  return { onKies, onNieuw };
}

describe("<GroepStrook /> (#1123)", () => {
  // Het zijn filters over de lijst eronder, geen tabbladen: aria-pressed, geen
  // tablist. Zelfde afweging als de filterchips van het clubblad (#912).
  it("is een groep schakelknoppen met een hoorbare ingedrukt-staat", () => {
    toon("g1");
    expect(
      screen.getByRole("group", { name: /groep kiezen/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vrijdagavond" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Dinsdaggroep" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /^alle$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("kiest 'Alle' als er niets in de URL staat", () => {
    toon("");
    expect(screen.getByRole("button", { name: /^alle$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("meldt de keuze met het groep-id, en 'Alle' als lege waarde", async () => {
    const { onKies } = toon("");
    await userEvent.click(screen.getByRole("button", { name: "Dinsdaggroep" }));
    expect(onKies).toHaveBeenCalledWith("g2");

    await userEvent.click(screen.getByRole("button", { name: /^alle$/i }));
    // Bewust "" en niet "alle": de afwezigheid van een groep is geen waarde
    // die je in de URL schrijft.
    expect(onKies).toHaveBeenLastCalledWith("");
  });

  // De "+" hoort in dezelfde rij als de groepen die hij aanvult, maar is geen
  // filter — dus geen aria-pressed, wél een naam voor wie hem niet ziet.
  it("heeft een nieuwe-groep-knop met een naam en zonder ingedrukt-staat", async () => {
    const { onNieuw, onKies } = toon("");
    const nieuw = screen.getByRole("button", { name: /nieuwe groep/i });
    expect(nieuw).not.toHaveAttribute("aria-pressed");

    await userEvent.click(nieuw);
    expect(onNieuw).toHaveBeenCalled();
    expect(onKies).not.toHaveBeenCalled();
  });
});
