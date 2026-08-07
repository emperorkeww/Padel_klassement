import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

import { DagSheet } from "./DagSheet";

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
    voterCount: 6,
    yesVoterIds: [],
    courts: "3 & 4",
    accessCode: "4821",
    changedAt: "2026-08-01T18:00:00.000Z",
    ...overrides,
  };
}

function toon(markers: AgendaMarker[]) {
  render(
    <MemoryRouter>
      <DagSheet
        datum="2026-08-13"
        markers={markers}
        ledenPerGroep={{ g1: 8 }}
        profielen={{}}
        onClose={() => {}}
      />
    </MemoryRouter>,
  );
}

describe("<DagSheet />", () => {
  beforeEach(() => downloadIcs.mockClear());

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
});
