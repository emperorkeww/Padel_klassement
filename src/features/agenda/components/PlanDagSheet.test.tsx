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

const CLUB = {
  id: "91d8d419-3736-498e-90be-362de786d588",
  name: "Padel De Panne",
  city: "De Panne",
  timezone: "Europe/Brussels",
};

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
  render(
    <MemoryRouter>
      <PlanDagSheet
        datum="2026-08-20"
        groepen={TWEE}
        gekozenGroep={null}
        onGroep={onGroep}
        club={CLUB}
        onClub={() => {}}
        vensterEinde="2026-08-13"
        onClose={() => {}}
        onDoor={onDoor}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onGroep, onDoor };
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
});
