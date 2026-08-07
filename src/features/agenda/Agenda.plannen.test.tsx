import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

/**
 * Een dag openen kost sinds #1112 twee tikken: de eerste kiest de dag (het
 * paneel eronder werkt bij), de tweede opent het detail. Dat is precies waarom
 * die tweede betekenis er is — anders was plannen van één tik naar twee gegaan.
 */
async function openDag(naam: RegExp) {
  const dag = await screen.findByRole("button", { name: naam });
  await userEvent.click(dag);
  await userEvent.click(dag);
  return dag;
}

describe("<Agenda /> — plannen op een bezette dag (#1104)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("laat je vanaf een dag met een speeldag een tweede speeldag starten", async () => {
    toon();
    await openDag(/donderdag 13 augustus, speeldag geboekt/);
    expect(
      await screen.findByRole("dialog", { name: /donderdag 13 augustus/ }),
    ).toBeInTheDocument();

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
    await openDag(/donderdag 13 augustus, speeldag gespeeld/);
    expect(
      await screen.findByRole("dialog", { name: /donderdag 13 augustus/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Plan hier ook een speeldag" }),
    ).not.toBeInTheDocument();
  });
});

describe("<Agenda /> — dag kiezen en openen (#1112)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("begint op vandaag", async () => {
    toon();
    expect(
      await screen.findByRole("heading", { name: /vandaag · vrijdag 7 augustus/i }),
    ).toBeInTheDocument();
  });

  it("laat de eerste tik de dag kiezen zonder iets te openen", async () => {
    toon();
    await userEvent.click(
      await screen.findByRole("button", {
        name: /donderdag 13 augustus, speeldag geboekt/,
      }),
    );
    // Het paneel gaat over 13 augustus...
    expect(
      screen.getByRole("heading", { name: /donderdag 13 augustus/i }),
    ).toBeInTheDocument();
    // ...en er staat níets overheen. Eén tik is kijken, geen handeling.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opent bij de tweede tik op dezelfde dag", async () => {
    toon();
    await openDag(/donderdag 13 augustus, speeldag geboekt/);
    expect(
      await screen.findByRole("dialog", { name: /donderdag 13 augustus/ }),
    ).toBeInTheDocument();
  });

  it("stuurt de tweede tik op een lege dag naar het plan-sheet", async () => {
    toon();
    // 20 augustus is leeg en ligt in de toekomst: daar valt te plannen, en dat
    // moet één tik blijven vanaf de dag die je al bekeek.
    await openDag(/donderdag 20 augustus, niets gepland/);
    expect(await screen.findByText("Plan een speeldag")).toBeInTheDocument();
  });

  it("wijst vanaf een lege dag naar de eerstvolgende speeldag", async () => {
    toon();
    // Vandaag (7 augustus) is leeg; 13 augustus is de eerstvolgende.
    const rij = await screen.findByRole("button", {
      name: /do 13 aug, 20:00, Vamos!/,
    });
    await userEvent.click(rij);
    expect(
      screen.getByRole("heading", { name: /donderdag 13 augustus/i }),
    ).toBeInTheDocument();
  });

  it("bladert met het toetsenbord door, ook al halen we verder op dan het raster", async () => {
    // Het ophaalvenster loopt zes weken voorbij het raster (#1112). Als de
    // toetsenbordnavigatie díe grens zou gebruiken in plaats van de
    // rastergrens, blijft de focus hangen op een dag die niet getekend is.
    toon();
    const raster = await screen.findByRole("grid");
    fireEvent.keyDown(raster, { key: "PageDown" });
    // findBy: het nieuwe maandvenster laadt, en dat is een async update.
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "September 2026",
    );
  });

  it("laat de gekozen dag meebladeren met de maand", async () => {
    toon();
    // 13 augustus kiezen, dan naar september. Zou de keuze blijven staan, dan
    // praat het paneel over een dag buiten het opgehaalde venster — en meldt
    // het "Nog niets gepland" voor een dag met een geboekte speeldag erop.
    await userEvent.click(
      await screen.findByRole("button", {
        name: /donderdag 13 augustus, speeldag geboekt/,
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /volgende maand/i }),
    );
    expect(
      await screen.findByRole("heading", { name: /dinsdag 1 september/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /13 augustus/i }),
    ).not.toBeInTheDocument();
  });

  it("bladert mee naar de maand van een aangetikte randdag", async () => {
    toon();
    // Het raster van augustus 2026 begint op maandag 27 juli.
    await userEvent.click(
      await screen.findByRole("button", { name: /maandag 27 juli/ }),
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Juli 2026");
    expect(
      screen.getByRole("heading", { name: /maandag 27 juli/i }),
    ).toBeInTheDocument();
  });
});
