import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Profile } from "@/types";
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
    clubId: "club-1",
    clubCity: "Beveren",
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
    maybeVoterIds: [],
    nietGestemdIds: [],
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

function toon(
  markers: AgendaMarker[],
  extra: AgendaMarker[] = [],
  /** Zoals Agenda hem doorgeeft: afwezig voor een dag die geweest is. */
  onPlan: (() => void) | undefined = undefined,
  profielen: Record<string, Profile> = {},
) {
  const onGestemd = vi.fn();
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <DagSheet
          datum="2026-08-13"
          markers={markers}
          momentenPerPoll={perPoll([...markers, ...extra])}
          ledenPerGroep={{ g1: 8 }}
          profielen={profielen}
          myId="me"
          onGestemd={onGestemd}
          onPlan={onPlan}
          onClose={onClose}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
  return { onGestemd, onClose };
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

  /* -------- Plannen op een dag die al bezet is (#1104) -------- */

  const PLAN = "Plan hier ook een speeldag";

  it("biedt een tweede speeldag aan op een dag die al iets draagt", async () => {
    const onPlan = vi.fn();
    toon([marker()], [], onPlan);
    await userEvent.click(screen.getByRole("button", { name: PLAN }));
    expect(onPlan).toHaveBeenCalledOnce();
  });

  it("laat de plan-knop weg voor een dag die geweest is", () => {
    // Agenda geeft `onPlan` dan niet door; het sheet toont niets uit zichzelf.
    toon([marker({ past: true })]);
    expect(screen.queryByRole("button", { name: PLAN })).not.toBeInTheDocument();
  });

  it("houdt de plan-knop weg bij een lege dag in het verleden", () => {
    // Die dag komt hier alleen terecht als er niets stond; plannen loopt dan al
    // via het plan-sheet en een tweede ingang zou de lege staat tegenspreken.
    toon([], [], vi.fn());
    expect(screen.queryByRole("button", { name: PLAN })).not.toBeInTheDocument();
  });
});

/* ---- #1121: wat de Plannen-tab wél toonde en de agenda niet ---- */

describe("<DagSheet /> — twijfelaars en stille leden (#1121)", () => {
  const PROFIELEN = {
    p2: { id: "p2", username: "bob", full_name: "Bob Boers", avatar_url: null, created_at: "2026-01-01T00:00:00Z" },
    p3: { id: "p3", username: "carol", full_name: "Carol Claes", avatar_url: null, created_at: "2026-01-01T00:00:00Z" },
  } as unknown as Record<string, Profile>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  // Bij "nog één speler nodig" is dit de vraag: wie kan ik nog porren? De
  // agenda gaf tot nu toe alleen het aantal ja-stemmers.
  it("noemt de twijfelaars bij naam", () => {
    toon(
      [marker({ status: "open", maybeVoterIds: ["p2"] })],
      [],
      undefined,
      PROFIELEN,
    );
    expect(screen.getByText("Misschien")).toBeInTheDocument();
    expect(screen.getByText("Bob Boers")).toBeInTheDocument();
  });

  it("noemt wie er nog helemaal niets zei", () => {
    toon(
      [marker({ status: "open", myVote: "yes", nietGestemdIds: ["p3"] })],
      [],
      undefined,
      PROFIELEN,
    );
    expect(screen.getByText("Nog niets gezegd")).toBeInTheDocument();
    expect(screen.getByText("Carol Claes")).toBeInTheDocument();
  });

  // Een vastgelegde dag stelt de vraag niet meer, dus dan blijft die rij weg.
  it("laat de stille leden weg zodra het moment vastligt", () => {
    toon([marker({ status: "locked", nietGestemdIds: ["p3"] })], [], undefined, PROFIELEN);
    expect(screen.queryByText("Nog niets gezegd")).not.toBeInTheDocument();
  });

  it("zegt waar de speeldag op wacht", () => {
    toon([marker({ status: "open", myVote: null })]);
    expect(screen.getByText("Jij moet nog stemmen.")).toBeInTheDocument();
  });
});

/* ---- #1180: een kop met sluitknop, en een sheet die korter blijft ---- */

describe("<DagSheet /> — kop en opbouw (#1180)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  // Dit sheet was het enige van de app zonder enige sluit-affordance: het gaf
  // geen `title` mee, dus er kwam ook geen X.
  it("zet de datum als kop, met een sluitknop ernaast", async () => {
    const { onClose } = toon([marker()]);
    expect(
      screen.getByRole("heading", { name: "donderdag 13 augustus" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sluiten" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  const NAMEN = Object.fromEntries(
    ["a", "b", "c", "d", "e", "f"].map((k, i) => [
      `n${i}`,
      {
        id: `n${i}`,
        username: k,
        full_name: `Speler ${k.toUpperCase()}`,
        avatar_url: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]),
  ) as unknown as Record<string, Profile>;

  it("vouwt een lange namenlijst op tot de eerste vier", async () => {
    toon(
      [
        marker({
          status: "open",
          myVote: "yes",
          nietGestemdIds: ["n0", "n1", "n2", "n3", "n4", "n5"],
        }),
      ],
      [],
      undefined,
      NAMEN,
    );

    // Twintig namen als lopende tekst maakten het sheet twee schermen lang.
    expect(screen.getByText(/Speler A, Speler B, Speler C, Speler D$/)).
      toBeInTheDocument();
    expect(screen.queryByText(/Speler E/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "+2 meer" }));
    expect(screen.getByText(/Speler E, Speler F$/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /meer$/ }),
    ).not.toBeInTheDocument();
  });

  it("laat een korte namenlijst met rust", () => {
    toon(
      [marker({ status: "open", maybeVoterIds: ["n0", "n1"] })],
      [],
      undefined,
      NAMEN,
    );
    expect(screen.getByText("Speler A, Speler B")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /meer$/ })).not.toBeInTheDocument();
  });

  it("telt de ja-stemmers die niet meer in de avatarrij passen", () => {
    // Zeven ja-stemmers, zes avatars: de zevende viel stilletjes weg terwijl
    // het kopje erboven "7 van 8" zei.
    toon([
      marker({
        status: "open",
        yesVoterIds: ["n0", "n1", "n2", "n3", "n4", "n5", "n6"],
      }),
    ]);
    expect(screen.getByText("Ik kan — 7 van 8")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("zet twee speeldagen op één dag in eigen vlakken", () => {
    toon([marker(), marker({ optionId: "opt-2", pollId: "poll-2" })]);
    expect(document.querySelector(".dagsheet--meerdere")).toBeInTheDocument();
    // En dat vlak is glas, niet een dekkende kaart op een glazen sheet (#1207).
    expect(document.querySelectorAll(".dagsheet__speeldag.glas")).toHaveLength(2);
  });

  it("houdt één speeldag randloos", () => {
    toon([marker()]);
    expect(document.querySelector(".dagsheet--meerdere")).not.toBeInTheDocument();
    expect(document.querySelector(".dagsheet__speeldag.glas")).not.toBeInTheDocument();
  });
});
