import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { PollWindow } from "@/features/groups/pollsApi";

// Een dag met een speeldag erop kon tot #1104 niets nieuws krijgen: kiesDag
// stuurde 'm naar het detail en daar hield het op. Deze test loopt de hele
// keten af — bezette dag → detail → plan-sheet — want dat is precies het stuk
// dat in Agenda.tsx zit en niet in DagSheet.

const CLUB = {
  id: "club-1",
  name: "Padel De Panne",
  city: "De Panne",
  timezone: "Europe/Brussels",
};

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "me" } }),
}));

vi.mock("@/features/availability/club", () => ({
  useClub: () => CLUB,
}));

// De clubkiezer haalt zelf clubs op; voor deze keten telt alleen dát er een
// club staat.
vi.mock("@/features/availability/components/ClubPicker", () => ({
  ClubPicker: () => <button type="button">Kies club</button>,
}));

vi.mock("@/features/groups/api", () => ({
  getMyGroups: () =>
    Promise.resolve([
      { id: "g1", name: "Vamos!", member_ids: ["me", "p2", "p3", "p4"] },
    ]),
}));

vi.mock("@/features/profiles/api", async (orig) => ({
  ...(await orig<typeof import("@/features/profiles/api")>()),
  getProfilesMap: () => Promise.resolve({}),
}));

const VENSTER: PollWindow = {
  polls: [
    {
      id: "poll-1",
      group_id: "g1",
      created_by: "p2",
      status: "booked",
      locked_option_id: "opt-1",
      created_at: "2026-08-01T10:00:00.000Z",
      locked_at: "2026-08-02T10:00:00.000Z",
      booked_at: "2026-08-02T11:00:00.000Z",
      club_id: CLUB.id,
      club_name: CLUB.name,
      club_city: CLUB.city,
      club_timezone: CLUB.timezone,
      access_code: null,
      courts: null,
      rounds_generated_at: null,
    },
  ],
  options: [
    {
      id: "opt-1",
      poll_id: "poll-1",
      group_id: "g1",
      date: "2026-08-13",
      start_time: "20:00",
      duration: 90,
      courts_free: null,
      created_at: "2026-08-01T10:00:00.000Z",
    },
  ],
  votes: [],
};

vi.mock("@/features/groups/pollsApi", async (orig) => ({
  ...(await orig<typeof import("@/features/groups/pollsApi")>()),
  getPollWindow: () => Promise.resolve(VENSTER),
}));

import { Agenda } from "./Agenda";

function toon() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <Agenda />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("<Agenda /> — plannen op een bezette dag (#1104)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("laat je vanaf een dag met een speeldag een tweede speeldag starten", async () => {
    toon();
    const dag = await screen.findByRole("button", {
      name: /donderdag 13 augustus, speeldag geboekt/,
    });
    await userEvent.click(dag);
    expect(await screen.findByText("Padel De Panne")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Plan hier ook een speeldag" }),
    );
    // Het detail sluit en dezelfde keten als bij een lege dag neemt het over.
    expect(await screen.findByText("Plan een speeldag")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Kies momenten/ }),
    ).toBeInTheDocument();
  });

  it("biedt die uitweg niet op een dag die geweest is", async () => {
    // 20 september: 13 augustus ligt dan achter ons, met de speeldag erop.
    vi.setSystemTime(new Date("2026-09-20T09:00:00Z"));
    toon();
    await userEvent.click(
      await screen.findByRole("button", { name: /vorige maand/i }),
    );
    const dag = await screen.findByRole("button", {
      name: /donderdag 13 augustus, speeldag gespeeld/,
    });
    await userEvent.click(dag);
    expect(await screen.findByText("Padel De Panne")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Plan hier ook een speeldag" }),
    ).not.toBeInTheDocument();
  });
});
