import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { makeSupabaseMock } from "../../test/supabaseMock";
import { TABLES, SESSION, MATCH_DONE, MATCH_PLANNED } from "../../test/fixtures";
import { AuthProvider } from "../auth/AuthProvider";

// Vast "nu" (3 juli 2026, Q3): zo is Q2 2026 een afgesloten seizoen met een
// kampioen. Alleen Date wordt gefaket, zodat waitFor/findBy gewoon blijven werken.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 6, 3, 12) });
});
afterAll(() => {
  vi.useRealTimers();
});

vi.mock("../../lib/supabase", () => {
  // Afgeronde match in Q2 2026, gewonnen door t-cd (Carol & Dave).
  const MATCH_Q2 = {
    ...MATCH_DONE,
    id: "m-q2",
    winner_team_id: "t-cd",
    score_a: 3,
    score_b: 6,
    played_at: "2026-05-10T10:00:00.000Z",
    created_at: "2026-05-10T10:00:00.000Z",
  };
  return {
    supabase: makeSupabaseMock({
      session: SESSION,
      tables: {
        ...TABLES,
        // De Q2-match eerst: de mock negeert order(), dus rij 0 bepaalt de
        // "eerste match" en daarmee de kwartalen in de seizoenskiezer.
        matches: [MATCH_Q2, MATCH_DONE, MATCH_PLANNED],
      },
    }),
  };
});

import Leaderboard from "./Leaderboard";

function renderPage(url = "/") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <Leaderboard />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<Leaderboard />", () => {
  it("toont de titel en een spelerrij (alle tijden als default)", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /klassement/i }),
    ).toBeInTheDocument();
    // Naam staat zowel in de desktop-tabel als in de mobiele ranglijst.
    expect((await screen.findAllByText(/alice anders/i)).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Seizoen")).toHaveValue("");
  });

  it("wisselt via de seizoenskiezer en toont de kampioensbanner van Q2", async () => {
    renderPage();
    // Wachten tot de kwartalen geladen zijn (afgeleid van de eerste match).
    await screen.findByRole("option", { name: "Q2 2026" });
    fireEvent.change(screen.getByLabelText("Seizoen"), {
      target: { value: "2026-q2" },
    });

    // Q2 is afgesloten: banner met de nummer 1 van dat kwartaal.
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("Kampioen Q2 2026: Carol Claes");
    // De kwartaalstand telt alleen de Q2-match: Carol & Dave wonnen die.
    expect((await screen.findAllByText(/carol claes/i)).length).toBeGreaterThan(0);
  });

  it("toont geen banner voor het lopende kwartaal", async () => {
    renderPage("/?seizoen=2026-q3");
    expect(screen.getByLabelText("Seizoen")).toHaveValue("2026-q3");
    expect((await screen.findAllByText(/alice anders/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("meldt een seizoen zonder matches en toont dan geen kampioen", async () => {
    renderPage("/?seizoen=2026-q1");
    expect(
      await screen.findByText("Geen matches in dit seizoen."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("valt bij een ongeldige seizoenswaarde terug op alle tijden", async () => {
    renderPage("/?seizoen=onzin");
    expect((await screen.findAllByText(/alice anders/i)).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Seizoen")).toHaveValue("");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
