import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";

const { tables } = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { VarStemKaart } from "@/features/dashboard/components/VarStemKaart";
import { MATCH_DONE, PROFILES, TEAMS } from "@/test/fixtures";

const EEN_UUR_GELEDEN = new Date(Date.now() - 3600_000).toISOString();

function zaak(over: Record<string, unknown> = {}) {
  return {
    id: "va-1",
    match_id: MATCH_DONE.id,
    claimant_id: "p3",
    set_number: null,
    reden: "dubbele-stuit",
    toelichting: null,
    status: "open",
    snapshot_a: 6,
    snapshot_b: 3,
    play_date: "2026-08-04",
    votes_close_at: new Date(Date.now() + 3600_000).toISOString(),
    resolved_at: null,
    created_at: EEN_UUR_GELEDEN,
    ...over,
  };
}

function toon(myId = "p1") {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <VarStemKaart myId={myId} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  tables.point_appeals = [];
  tables.point_appeal_votes = [];
  tables.matches = [{ ...MATCH_DONE, played_at: EEN_UUR_GELEDEN }];
  tables.teams = TEAMS;
  tables.profiles = PROFILES;
});

describe("<VarStemKaart />", () => {
  it("blijft weg zonder openstaande zaak", async () => {
    toon();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByLabelText("VAR-zaak")).toBeNull();
  });

  it("legt de zaak voor aan wie mag stemmen", async () => {
    tables.point_appeals = [zaak()];
    toon();
    expect(await screen.findByText(/betwist één punt/i)).toHaveTextContent(
      "Carol",
    );
    expect(screen.getByRole("button", { name: "Klopt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Onzin" })).toBeInTheDocument();
    // De correctie in cijfers, zodat je weet waar je over stemt.
    expect(screen.getByText("6 – 3")).toBeInTheDocument();
    expect(screen.getByText("5 – 4")).toBeInTheDocument();
  });

  it("laat de klager zijn eigen zaak niet zien", async () => {
    tables.point_appeals = [zaak()];
    toon("p3");
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByLabelText("VAR-zaak")).toBeNull();
  });

  it("verdwijnt zodra je gestemd hebt", async () => {
    tables.point_appeals = [zaak()];
    tables.point_appeal_votes = [
      {
        appeal_id: "va-1",
        voter_id: "p1",
        akkoord: true,
        created_at: EEN_UUR_GELEDEN,
      },
    ];
    toon();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByLabelText("VAR-zaak")).toBeNull();
  });

  it("laat een buitenstaander met stemrecht noch zaak niets zien", async () => {
    tables.point_appeals = [zaak()];
    toon("p9");
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByLabelText("VAR-zaak")).toBeNull();
  });
});
