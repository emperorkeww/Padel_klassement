import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { PollWindow } from "@/features/groups/pollsApi";

/* Abonneren stond tot #1197 als laatste blok onderaan de pagina, onder raster,
   dagpaneel én suggesties: wie niet toevallig doorscrolde wist niet dat de feed
   bestond. Deze test bewaakt de twee dingen die dat oplossen — een instap boven
   de vouw, in béide weergaven, en een regel onderaan die hetzelfde opent. */

const CLUB = {
  id: "club-1",
  name: "Padel De Panne",
  city: "De Panne",
  timezone: "Europe/Brussels",
};

const tables = vi.hoisted(() => ({ calendar_feeds: [] }) as Record<string, unknown[]>);
const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  const mock = makeSupabaseMock({ session: SESSION, tables });
  return { supabase: { ...mock, rpc } };
});

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "me" } }),
}));

vi.mock("@/features/availability/club", () => ({
  useClub: () => CLUB,
}));

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

const VENSTER: PollWindow = { polls: [], options: [], votes: [] };

vi.mock("@/features/groups/pollsApi", async (orig) => ({
  ...(await orig<typeof import("@/features/groups/pollsApi")>()),
  getPollWindow: () => Promise.resolve(VENSTER),
}));

import { Agenda } from "./Agenda";

function toon(url = "/agenda") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <Agenda />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const ABO_KNOP = { name: "Abonneren op je agenda" };
const ABO_SHEET = { name: /je speeldagen in je eigen agenda/i };

describe("<Agenda /> — abonneren bereikbaar houden (#1197)", () => {
  beforeEach(() => {
    rpc.mockReset();
    tables.calendar_feeds = [];
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("opent het abonneer-sheet vanaf de knop bij de weergavekeuze", async () => {
    toon();
    await userEvent.click(await screen.findByRole("button", ABO_KNOP));

    const sheet = await screen.findByRole("dialog", ABO_SHEET);
    // De inhoud is dezelfde als vroeger onderaan de pagina stond.
    expect(
      await screen.findByRole("button", { name: /maak mijn agenda-link/i }),
    ).toBeInTheDocument();
    // Het sheet draagt de titel; de sectie erbinnen herhaalt hem niet — anders
    // staat dezelfde kop er twee keer boven elkaar.
    expect(
      within(sheet).getAllByRole("heading", { name: ABO_SHEET.name }),
    ).toHaveLength(1);
  });

  it("laat Escape het sheet sluiten", async () => {
    toon();
    await userEvent.click(await screen.findByRole("button", ABO_KNOP));
    expect(await screen.findByRole("dialog", ABO_SHEET)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", ABO_SHEET)).not.toBeInTheDocument(),
    );
  });

  it("houdt de knop ook in de lijstweergave", async () => {
    // Dit is de reden dat de knop níet in de maandkop staat: die knoppenrij is
    // in de lijst `hidden`, en dan was abonneren daar onbereikbaar.
    toon("/agenda?weergave=lijst");
    expect(
      screen.queryByRole("button", { name: /volgende maand/i }),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole("button", ABO_KNOP)).toBeInTheDocument();
  });

  it("heeft nog maar één ingang naar dat sheet (#1270)", async () => {
    // De teaserregel onderaan opende exact hetzelfde sheet als de knop bij de
    // weergavekeuze, en stond pal naast de segmentbalk waar hij als een derde
    // weergave las. Twee wegen naar één instelling die je één keer doet is er
    // een te veel; de knop staat al boven de vouw en in beide weergaven.
    toon();
    expect(await screen.findByRole("button", ABO_KNOP)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /zet je speeldagen in je eigen agenda/i,
      }),
    ).not.toBeInTheDocument();
  });
});
