import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { AgendaMarker } from "../agendaLogic";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});

const downloadIcs = vi.fn();
vi.mock("@/lib/utils/ics", async (orig) => ({
  ...(await orig<typeof import("@/lib/utils/ics")>()),
  downloadIcs: (...args: unknown[]) => downloadIcs(...args),
}));

const setPollVote = vi.fn(() => Promise.resolve());
const clearPollVote = vi.fn(() => Promise.resolve());
vi.mock("@/features/groups/pollsApi", async (orig) => ({
  ...(await orig<typeof import("@/features/groups/pollsApi")>()),
  setPollVote: (...args: unknown[]) => setPollVote(...(args as [])),
  clearPollVote: (...args: unknown[]) => clearPollVote(...(args as [])),
}));

import { DagSheet } from "./DagSheet";
import { ToastProvider } from "@/ui/ToastProvider";

function marker(overrides: Partial<AgendaMarker> = {}): AgendaMarker {
  return {
    pollId: "poll-1",
    optionId: "opt-1",
    groupId: "g1",
    groupName: "Vamos!",
    clubName: "Padel De Panne",
    clubTimezone: "Europe/Brussels",
    date: "2026-08-13",
    startTime: "20:00",
    duration: 90,
    status: "booked",
    past: false,
    iVoted: false,
    myVote: null,
    voterCount: 6,
    yesVoterIds: [],
    courts: "3 & 4",
    accessCode: "4821",
    changedAt: "2026-08-01T18:00:00.000Z",
    ...overrides,
  };
}

/** Alle markers per poll, zoals Agenda ze aanlevert. */
function perPoll(markers: AgendaMarker[]): Record<string, AgendaMarker[]> {
  const out: Record<string, AgendaMarker[]> = {};
  for (const m of markers) (out[m.pollId] ??= []).push(m);
  return out;
}

function toon(markers: AgendaMarker[], extra: AgendaMarker[] = []) {
  const onGestemd = vi.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <DagSheet
          datum="2026-08-13"
          markers={markers}
          momentenPerPoll={perPoll([...markers, ...extra])}
          ledenPerGroep={{ g1: 8 }}
          profielen={{}}
          myId="me"
          onGestemd={onGestemd}
          onClose={() => {}}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
  return { onGestemd };
}

describe("<DagSheet />", () => {
  beforeEach(() => {
    downloadIcs.mockClear();
    setPollVote.mockClear();
    clearPollVote.mockClear();
    // Het sheet beoordeelt zelf of een moment al voorbij is, dus de klok moet
    // vastliggen: anders komt er een dag dat 13 augustus 2026 verleden tijd is
    // en de stemknoppen "terecht" verdwijnen. shouldAdvanceTime houdt
    // userEvent werkbaar (patroon uit PollWizard.initialDay.test).
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("toont tijdvak, groep, club, banen en code van een geboekte dag", () => {
    toon([marker()]);
    expect(screen.getByText("20:00 — 21:30")).toBeInTheDocument();
    expect(screen.getByText("Vamos!")).toBeInTheDocument();
    expect(screen.getByText("Padel De Panne")).toBeInTheDocument();
    expect(screen.getByText("Baan 3 & 4")).toBeInTheDocument();
    expect(screen.getByText("4821")).toBeInTheDocument();
  });

  it("houdt banen en code weg zolang er niet geboekt is", () => {
    toon([marker({ status: "locked" })]);
    expect(screen.queryByText("4821")).not.toBeInTheDocument();
    expect(screen.getByText(/baan moet nog geboekt worden/)).toBeInTheDocument();
  });

  it("downloadt een agenda-event voor een vastgelegde speeldag", async () => {
    toon([marker()]);
    await userEvent.click(screen.getByRole("button", { name: "Zet in je agenda" }));
    expect(downloadIcs).toHaveBeenCalledOnce();
    const [naam, ics] = downloadIcs.mock.calls[0] as [string, string];
    expect(naam).toBe("speeldag-2026-08-13.ics");
    expect(ics).toContain("SUMMARY:Padel: Vamos!");
    expect(ics).toContain("LOCATION:Padel De Panne");
    expect(ics).toContain("UID:speeldag-poll-1@vamos-padel");
    // 20:00 + 90 minuten.
    expect(ics).toContain("20260813T200000");
    expect(ics).toContain("20260813T213000");
  });

  it("biedt geen agenda-download voor een open poll", () => {
    toon([marker({ status: "open" })]);
    expect(
      screen.queryByRole("button", { name: "Zet in je agenda" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open speeldag" })).toBeInTheDocument();
  });

  it("zet meerdere groepen op één dag onder elkaar", () => {
    toon([
      marker(),
      marker({
        optionId: "opt-2",
        pollId: "poll-2",
        groupId: "g2",
        groupName: "Kantoorpadel",
        startTime: "18:30",
        status: "open",
      }),
    ]);
    expect(screen.getByText("Vamos!")).toBeInTheDocument();
    expect(screen.getByText("Kantoorpadel")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open speeldag" })).toHaveLength(2);
  });

  it("meldt een lege dag in het verleden zonder uitnodiging", () => {
    toon([]);
    expect(screen.getByText("Niets gespeeld")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  /* -------- Stemmen vanuit de agenda (#1104) -------- */

  const open = (o: Partial<AgendaMarker> = {}) =>
    marker({ status: "open", courts: null, accessCode: null, ...o });

  it("laat je stemmen op een open poll, en meldt dat terug", async () => {
    const { onGestemd } = toon([open()]);
    await userEvent.click(
      screen.getByRole("button", { name: "Ik kan — donderdag 13 augustus 20:00" }),
    );
    expect(setPollVote).toHaveBeenCalledWith("opt-1", "g1", "me", "yes");
    await vi.waitFor(() => expect(onGestemd).toHaveBeenCalled());
  });

  it("haalt je stem weg als je opnieuw op je eigen keuze tikt", async () => {
    toon([open({ myVote: "yes" })]);
    const ja = screen.getByRole("button", {
      name: "Ik kan — donderdag 13 augustus 20:00",
    });
    expect(ja).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(ja);
    expect(clearPollVote).toHaveBeenCalledWith("opt-1", "me");
    expect(setPollVote).not.toHaveBeenCalled();
    // Optimistisch: de knop laat meteen los, zonder op de server te wachten.
    expect(ja).toHaveAttribute("aria-pressed", "false");
  });

  it("laat de andere momenten van dezelfde poll meestemmen", async () => {
    toon(
      [open()],
      [
        open({ optionId: "opt-2", date: "2026-08-15", startTime: "18:30", yesVoterIds: ["p2"] }),
        // Andere poll, zelfde venster: hoort hier niet bij.
        open({ optionId: "opt-9", pollId: "poll-9", date: "2026-08-16" }),
      ],
    );
    expect(screen.getByText("Andere momenten in deze poll")).toBeInTheDocument();
    expect(screen.getByText("za 15 aug · 18:30")).toBeInTheDocument();
    expect(screen.queryByText(/16 aug/)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Misschien — zaterdag 15 augustus 18:30" }),
    );
    expect(setPollVote).toHaveBeenCalledWith("opt-2", "g1", "me", "maybe");
  });

  it("laat het kopje weg als de poll maar één moment heeft", () => {
    toon([open()]);
    expect(
      screen.queryByText("Andere momenten in deze poll"),
    ).not.toBeInTheDocument();
  });

  it("biedt geen stemknoppen bij een vastgelegde of geboekte dag", () => {
    toon([marker({ status: "booked" })]);
    expect(screen.queryByRole("group", { name: /Jouw stem/ })).not.toBeInTheDocument();
    toon([marker({ status: "locked" })]);
    expect(screen.queryByRole("group", { name: /Jouw stem/ })).not.toBeInTheDocument();
  });

  it("zet de stemknoppen uit zodra het moment verloopt terwijl je kijkt", () => {
    // Het slot loopt tot 21:30 clubtijd (19:30 UTC); we staan er vlak voor.
    vi.setSystemTime(new Date("2026-08-13T19:29:00Z"));
    toon([open()]);
    expect(screen.getByRole("group", { name: /Jouw stem/ })).toBeInTheDocument();
    // De klok in het sheet tikt door; `past` op de marker staat nog op false.
    act(() => void vi.advanceTimersByTime(2 * 60_000));
    expect(screen.queryByRole("group", { name: /Jouw stem/ })).not.toBeInTheDocument();
  });
});
