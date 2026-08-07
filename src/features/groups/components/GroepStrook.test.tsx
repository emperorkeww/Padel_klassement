import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroepStrook } from "./GroepStrook";
import type { Journey } from "../journey";
import type { GroupSummary } from "../api";

const groepen = [
  { id: "g1", name: "Vrijdagavond", member_ids: ["a", "b"] },
  { id: "g2", name: "Dinsdaggroep", member_ids: ["a"] },
] as unknown as GroupSummary[];

function toon(gekozen = "", journeys?: Record<string, Journey>) {
  const onKies = vi.fn();
  const onNieuw = vi.fn();
  const r = render(
    <GroepStrook
      groepen={groepen}
      gekozen={gekozen}
      onKies={onKies}
      onNieuw={onNieuw}
      journeys={journeys}
    />,
  );
  return { onKies, onNieuw, ...r };
}

const journey = (over: Partial<Journey>): Journey => ({
  icon: null,
  label: "Poll loopt — stem mee",
  tone: "act",
  status: "open",
  tab: "agenda",
  ...over,
});

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

  // ── #1123: de stip ────────────────────────────────────────────────────────

  // Vorm draagt de status (WCAG 1.4.1), maar de stip is decoratief: wie hem
  // niet ziet moet de status alsnog horen. Vandaar de tekst in de naam.
  it("zet de status in de naam van de chip, met de stip als decoratie", () => {
    toon("", {
      g1: journey({ status: "open", label: "Poll loopt — stem mee" }),
      g2: journey({ status: "booked", label: "vr 14 aug · 20:00 geboekt" }),
    });
    expect(
      screen.getByRole("button", { name: /vrijdagavond, poll loopt — stem mee/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /dinsdaggroep, vr 14 aug · 20:00 geboekt/i }),
    ).toBeInTheDocument();
  });

  it("geeft elke stand een eigen vorm, niet alleen een eigen kleur", () => {
    const { container } = toon("", {
      g1: journey({ status: "open" }),
      g2: journey({ status: "booked" }),
    });
    const klassen = [...container.querySelectorAll(".agenda-glyph")].map(
      (el) => el.className,
    );
    expect(klassen).toEqual([
      "agenda-glyph agenda-glyph--open",
      "agenda-glyph agenda-glyph--booked",
    ]);
  });

  // De journeys komen uit een tweede query; zonder gereserveerde ruimte
  // verspringen de chips horizontaal zodra die binnenvalt.
  it("houdt de plek van de stip vrij zolang de status nog laadt", () => {
    const { container } = toon();
    expect(container.querySelectorAll(".groep-strook__stip")).toHaveLength(2);
    expect(container.querySelector(".agenda-glyph")).toBeNull();
  });

  it("toont geen stip voor een groep zonder speeldag", () => {
    const { container } = toon("", { g1: journey({ status: null }) });
    expect(container.querySelector(".agenda-glyph")).toBeNull();
    expect(
      screen.getByRole("button", { name: /vrijdagavond, poll loopt/i }),
    ).toBeInTheDocument();
  });
});
