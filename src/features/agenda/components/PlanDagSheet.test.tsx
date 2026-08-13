import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { GroupSummary } from "@/features/groups/api";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});

import { PlanDagSheet } from "./PlanDagSheet";

function groep(id: string, name: string, leden = 8): GroupSummary {
  return {
    id,
    name,
    created_by: "p1",
    created_at: "2026-01-01T00:00:00Z",
    member_ids: Array.from({ length: leden }, (_, i) => `p${i}`),
  };
}

const TWEE = [groep("g1", "Vamos!"), groep("g2", "Kantoorpadel", 12)];

function toon(props: Partial<Parameters<typeof PlanDagSheet>[0]> = {}) {
  const onGroep = vi.fn();
  const onDoor = vi.fn();
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <PlanDagSheet
        datum="2026-08-20"
        groepen={TWEE}
        gekozenGroep={null}
        onGroep={onGroep}
        vensterEinde="2026-08-13"
        onClose={onClose}
        onDoor={onDoor}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onGroep, onDoor, onClose };
}

describe("<PlanDagSheet />", () => {
  it("vraagt bij meerdere groepen eerst welke", () => {
    toon();
    expect(screen.getByText("Voor welke groep?")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    // Zonder keuze valt er niets door te geven aan de wizard.
    expect(screen.getByRole("button", { name: /Kies momenten/ })).toBeDisabled();
  });

  it("slaat de groepsstap over bij precies één groep", () => {
    toon({ groepen: [groep("g1", "Vamos!")] });
    expect(screen.queryByText("Voor welke groep?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kies momenten/ })).toBeEnabled();
  });

  it("start op de onthouden groep", () => {
    toon({ gekozenGroep: "g2" });
    const gekozen = screen.getByRole("radio", { checked: true });
    expect(gekozen.closest("label")).toHaveTextContent("Kantoorpadel");
    expect(gekozen.closest("label")).toHaveTextContent("laatst gebruikt");
    expect(screen.getByRole("button", { name: /Kies momenten/ })).toBeEnabled();
  });

  it("negeert een onthouden groep die je verliet (#1270)", () => {
    // Met een oude id in `agenda-laatste-groep` stond er geen rij aangevinkt,
    // was "Kies momenten →" tóch actief, en sloot de klik alles zonder iets te
    // openen: de wizard kreeg een groep die niet meer bestaat.
    toon({ gekozenGroep: "verlaten-groep" });
    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kies momenten/ })).toBeDisabled();
  });

  it("valt bij één groep terug op die ene, ook met een oude id", () => {
    // Daar valt niets te kiezen, dus die stap hoort niet in de weg te zitten.
    toon({ groepen: [groep("g1", "Vamos!")], gekozenGroep: "verlaten-groep" });
    expect(screen.getByRole("button", { name: /Kies momenten/ })).toBeEnabled();
  });

  it("vraagt de club hier niet meer (#1270, #1271)", () => {
    // De clubnaam stond hier eerst twee keer: als tekst links en in de knop
    // rechts, wat op 390px "LAG…" opleverde naast dezelfde naam voluit (#1270).
    // Daarna bleek de vraag zélf dubbel: het scherm hierna stelt hem opnieuw,
    // op dezelfde state, en dáár zie je wat je keuze oplevert (#1271).
    toon();
    expect(screen.queryByText(/Padel De Panne/)).not.toBeInTheDocument();
    expect(screen.queryByText("Club")).not.toBeInTheDocument();
    expect(screen.queryByText("je huidige clubkeuze")).not.toBeInTheDocument();
  });

  it("meldt de keuze terug en geeft daarna het stokje door", async () => {
    const { onGroep } = toon();
    await userEvent.click(screen.getByText("Kantoorpadel"));
    expect(onGroep).toHaveBeenCalledWith("g2");

    // Met een groep gekozen mag de wizard open.
    const { onDoor } = toon({ gekozenGroep: "g2" });
    await userEvent.click(
      screen.getAllByRole("button", { name: /Kies momenten/ })[1],
    );
    expect(onDoor).toHaveBeenCalledOnce();
  });

  it("waarschuwt voor een dag buiten het beschikbaarheidsvenster", () => {
    toon({ datum: "2026-08-26", vensterEinde: "2026-08-13" });
    expect(
      screen.getByText(/valt buiten het venster van 7 dagen/),
    ).toBeInTheDocument();
    expect(screen.getByText(/handmatige pad/)).toBeInTheDocument();
  });

  it("zwijgt over het venster voor een dag die er wél in valt", () => {
    toon({ datum: "2026-08-11", vensterEinde: "2026-08-13" });
    expect(screen.queryByText(/buiten het venster/)).not.toBeInTheDocument();
  });

  it("toont de dag voluit", () => {
    toon({ datum: "2026-08-26" });
    expect(screen.getAllByText(/woensdag 26 augustus/)[0]).toBeInTheDocument();
    expect(screen.getByText("Plan een speeldag")).toBeInTheDocument();
  });

  // Tot #1180 had dit sheet geen X: alleen "Terug" onderin en een tik naast
  // het paneel. Die "Terug" hoort bij de keuze en niet bij het sluiten.
  it("zet de titel als kop, met een sluitknop ernaast", async () => {
    const { onClose } = toon();
    expect(
      screen.getByRole("heading", { name: "Plan een speeldag" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sluiten" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
