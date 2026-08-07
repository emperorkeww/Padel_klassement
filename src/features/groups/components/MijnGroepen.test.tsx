import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MijnGroepen, ALLES_DREMPEL } from "./MijnGroepen";
import type { GroupSummary } from "../api";

const groepen = [
  { id: "g1", name: "Balleke slaan", created_by: "p1", member_ids: ["p1", "p2"] },
  { id: "g2", name: "Woensdagavond", created_by: "p9", member_ids: ["p1"] },
] as unknown as GroupSummary[];

/** n groepen, allemaal van iemand anders. */
const veelGroepen = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `g${i}`,
    name: `Groep ${i}`,
    created_by: "p9",
    member_ids: ["p1"],
  })) as unknown as GroupSummary[];

function toon(props: Partial<Parameters<typeof MijnGroepen>[0]> = {}) {
  return render(
    <MemoryRouter>
      <MijnGroepen groepen={groepen} myId="p1" profiles={{}} {...props} />
    </MemoryRouter>,
  );
}

describe("<MijnGroepen /> (#1134)", () => {
  // Een eigen gebied met een kop: "Mijn groepen" en de matches eronder zijn
  // twee dingen, en koppennavigatie hoort ze allebei te vinden.
  it("is een benoemd gebied met een kop", () => {
    toon();
    const sectie = screen.getByRole("region", { name: /mijn groepen/i });
    expect(
      within(sectie).getByRole("heading", { name: /mijn groepen/i }),
    ).toBeInTheDocument();
  });

  it("zet elke groep als eigen kaart neer, met de eigenaarsbadge op de juiste", () => {
    toon();
    const kaarten = screen.getAllByRole("link");
    expect(kaarten).toHaveLength(2);
    expect(kaarten[0]).toHaveAttribute("href", "/groepen/g1");
    expect(kaarten[1]).toHaveAttribute("href", "/groepen/g2");
    // g1 is van mij (created_by p1), g2 niet.
    expect(within(kaarten[0]).getByText(/eigenaar/i)).toBeInTheDocument();
    expect(within(kaarten[1]).queryByText(/eigenaar/i)).toBeNull();
  });

  // Skeletons in de rij zelf, niet in plaats van de sectie: anders verspringt de
  // kop en alles eronder zodra de groepen binnenvallen.
  it("toont skeletonkaarten in dezelfde rij zolang de groepen laden", () => {
    const { container } = toon({ groepen: [], laadt: true });
    expect(
      screen.getByRole("region", { name: /mijn groepen/i }),
    ).toBeInTheDocument();
    const rij = container.querySelector(".mijn-groepen__rij")!;
    expect(rij.querySelectorAll(".sk-group")).toHaveLength(2);
    expect(screen.queryByRole("link")).toBeNull();
  });

  // ── "Alles bekijken" (#1134) ──────────────────────────────────────────────

  // Onder de drempel veeg je in één beweging door de rij; dan is een knop naar
  // een tweede voorstelling van dezelfde groepen alleen maar ruis.
  it("houdt 'Alles bekijken' weg tot de rij lang genoeg is", () => {
    toon({ groepen: veelGroepen(ALLES_DREMPEL) });
    expect(screen.queryByRole("button", { name: /alles bekijken/i })).toBeNull();
  });

  it("meldt in het label hoeveel groepen er zijn", () => {
    toon({ groepen: veelGroepen(ALLES_DREMPEL + 3) });
    // Het aantal staat ín de zichtbare tekst, zodat de toegankelijke naam die
    // tekst blijft bevatten (WCAG 2.5.3).
    expect(
      screen.getByRole("button", { name: `Alles bekijken (${ALLES_DREMPEL + 3})` }),
    ).toBeInTheDocument();
  });

  it("opent een sheet met dezelfde kaarten onder elkaar", async () => {
    toon({ groepen: veelGroepen(6) });
    expect(screen.getAllByRole("link")).toHaveLength(6);

    await userEvent.click(
      screen.getByRole("button", { name: /alles bekijken/i }),
    );
    const sheet = within(await screen.findByRole("dialog"));
    // Dezelfde kaarten, niet een uitgeklede tweede voorstelling.
    expect(sheet.getAllByRole("link")).toHaveLength(6);
    expect(sheet.getAllByRole("link")[0]).toHaveAttribute("href", "/groepen/g0");
  });

  it("sluit het sheet met Escape", async () => {
    toon({ groepen: veelGroepen(6) });
    await userEvent.click(
      screen.getByRole("button", { name: /alles bekijken/i }),
    );
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Tijdens het laden is het aantal nog onbekend; de knop zou dan verschijnen
  // en meteen weer weg kunnen springen.
  it("toont 'Alles bekijken' niet zolang de groepen laden", () => {
    toon({ groepen: [], laadt: true });
    expect(screen.queryByRole("button", { name: /alles bekijken/i })).toBeNull();
  });
});
