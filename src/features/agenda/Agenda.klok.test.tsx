import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { PollWindow } from "@/features/groups/pollsApi";

/* ------------------------------------------------------------------ */
/* #1270: de klok stond stil.                                          */
/*                                                                     */
/* `buildMarkers(…, Date.now())` zat in een useMemo, dus "is dit al     */
/* geweest?" bevroor op het moment dat het venster laadde. Het          */
/* dag-sheet tikte zelf al door (#1104), maar het raster, de kaarten en */
/* de actiestrook niet: een moment dat om 20:00 begon bleef "Jij moet   */
/* nog stemmen" tot je herlaadde.                                      */
/* ------------------------------------------------------------------ */

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

vi.mock("@/features/availability/club", () => ({ useClub: () => CLUB }));

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

/** Eén open poll op vandaag om 20:00, 90 minuten. Niemand stemde. */
const VENSTER: PollWindow = {
  polls: [
    {
      id: "poll-1",
      group_id: "g1",
      created_by: "p2",
      status: "open",
      locked_option_id: null,
      created_at: "2026-08-13T10:00:00.000Z",
      locked_at: null,
      booked_at: null,
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
      created_at: "2026-08-13T10:00:00.000Z",
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
    <MemoryRouter initialEntries={["/agenda"]}>
      <ToastProvider>
        <Agenda />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("<Agenda /> — de klok tikt door (#1270)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 13 augustus 2026, 19:00 Brussel (UTC+2): het slot van 20:00 moet nog
    // beginnen.
    vi.setSystemTime(new Date("2026-08-13T17:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("laat een moment vervallen zonder dat je herlaadt", async () => {
    toon();
    // Vooraf: er valt te stemmen, en de strook zegt dat.
    expect(
      await screen.findByText(/jij moet nog stemmen op de speeldag/i),
    ).toBeInTheDocument();

    // Twee uur verder: het slot van 20:00–21:30 is voorbij. Een open poll met
    // alleen verlopen momenten valt uit het raster, en dus ook uit de strook.
    await act(async () => {
      vi.setSystemTime(new Date("2026-08-13T19:45:00Z"));
      await vi.advanceTimersByTimeAsync(60_000);
    });

    await waitFor(() =>
      expect(
        screen.queryByText(/jij moet nog stemmen op de speeldag/i),
      ).not.toBeInTheDocument(),
    );
  });

  it("schuift vandaag mee over middernacht", async () => {
    toon();
    expect(
      await screen.findByRole("heading", {
        name: /vandaag · donderdag 13 augustus/i,
      }),
    ).toBeInTheDocument();

    // 00:30 Brussel is de volgende dag; de agenda bleef anders een dag lang
    // gisteren aanwijzen (dezelfde tijdzoneregel als #783).
    await act(async () => {
      vi.setSystemTime(new Date("2026-08-13T22:30:00Z"));
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(
      await screen.findByRole("heading", {
        name: /vandaag · vrijdag 14 augustus/i,
      }),
    ).toBeInTheDocument();
  });
});
