import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Profile } from "@/types";
import type { DayAvailability } from "@/features/availability/api";
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

// De baanbeschikbaarheid landt ná het openen; die vertraging is precies wat
// #1233 in de hand houdt, dus hij is hier stuurbaar. Standaard blijft de
// belofte hangen — dan staat het sheet in de toestand waarin je hem in het echt
// het eerst ziet.
let baanAntwoord: {
  resolve: (d: DayAvailability) => void;
  reject: (e: unknown) => void;
} | null = null;
const getClubAvailability = vi.fn(
  () =>
    new Promise<DayAvailability>((resolve, reject) => {
      baanAntwoord = { resolve, reject };
    }),
);
vi.mock("@/features/availability/api", async (orig) => ({
  ...(await orig<typeof import("@/features/availability/api")>()),
  getClubAvailability: () => getClubAvailability(),
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
    courtsFree: null,
    changedAt: "2026-08-01T18:00:00.000Z",
    ...overrides,
  };
}

/** Een dagantwoord van Playtomic met één vrije baan op 20:00 voor 90 minuten. */
function dagMetVrijeBaan(): DayAvailability {
  return {
    open: "08:00",
    close: "23:00",
    timeZone: "Europe/Brussels",
    courts: [
      {
        court: { id: "c1", name: "Baan 1", type: "indoor" },
        free: new Map([
          ["20:00", [{ duration: 90, price: "30 EUR", perPerson: "€ 7,50" }]],
        ]),
      },
    ],
    source: "live",
    fetchedAt: null,
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
  /** Wat er die dag los gespeeld is, plus de tellers per speeldag (#1270). */
  gespeeld: {
    wedstrijden?: Parameters<typeof DagSheet>[0]["wedstrijden"];
    wedstrijdenPerPoll?: Record<string, number>;
    groepNamen?: Record<string, string>;
  } = {},
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
          {...gespeeld}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
  return { onGestemd, onClose };
}

/** Losse partijen: het tijdstip doet er in dit sheet niet toe — die verdeling
 *  is al gemaakt voordat het sheet iets te zien krijgt (#1221). */
const wed = (...ids: string[]) => ids.map((id) => ({ id, atMs: 0 }));

describe("<DagSheet />", () => {
  beforeEach(() => {
    downloadIcs.mockClear();
    setPollVote.mockClear();
    clearPollVote.mockClear();
    getClubAvailability.mockClear();
    baanAntwoord = null;
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
    // Zonder `onPlan`, want die dag valt niet meer te plannen — precies het
    // onderscheid waar de lege staat sinds #1270 op leunt.
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

  it("biedt op een lege dag die nog komt de weg naar plannen (#1270)", async () => {
    // `/agenda?dag=<volgende week>&open=1` kwam hier gewoon uit en zei "Deze dag
    // is geweest" over een dag die nog moet komen — een doodlopende link,
    // terwijl de URL sinds #1182 juist bedoeld is om te delen. Hetzelfde pad
    // ontstaat als het groepsfilter de speeldagen van die dag wegzeeft.
    const onPlan = vi.fn();
    toon([], [], onPlan);
    expect(screen.queryByText("Niets gespeeld")).not.toBeInTheDocument();
    expect(screen.getByText("Nog niets gepland")).toBeInTheDocument();
    // Niet "Plan hier ook": er staat nog niets om iets naast te zetten.
    expect(screen.queryByRole("button", { name: PLAN })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Speeldag plannen" }));
    expect(onPlan).toHaveBeenCalledOnce();
  });

  /* -------- Wat er los gespeeld is (#1182, hierheen in #1270) -------- */

  const LOS = { date: "2026-08-13", groupId: "g1" };

  it("zegt niet dat er niets gespeeld is als er wél gespeeld is", () => {
    // Deze rijen stonden in het dagpaneel, dat over de gekozen dag ging. Nu een
    // tik meteen dít sheet opent, zou een avond met drie gelogde wedstrijden
    // anders doodleuk "Niets gespeeld" heten.
    toon([], [], undefined, {}, {
      wedstrijden: [{ ...LOS, matches: wed("m1", "m2", "m3") }],
      groepNamen: { g1: "Vrijdagavond Padel" },
    });
    expect(screen.queryByText(/deze dag is geweest/i)).not.toBeInTheDocument();
    expect(screen.getByText("3 wedstrijden")).toBeInTheDocument();
    // Meerdere wedstrijden: naar het matchoverzicht van de groep, want een
    // dagfilter bestaat daar niet.
    expect(screen.getByRole("link", { name: /3 wedstrijden/ })).toHaveAttribute(
      "href",
      "/spelen?groep=g1",
    );
  });

  it("linkt bij één wedstrijd naar die wedstrijd", () => {
    toon([], [], undefined, {}, {
      wedstrijden: [{ ...LOS, matches: wed("m1") }],
    });
    expect(screen.getByRole("link", { name: /1 wedstrijd/ })).toHaveAttribute(
      "href",
      "/matches/m1",
    );
  });

  it("geeft de gespeeld-rij dezelfde schil als een speeldagkaart (#1207)", () => {
    toon([], [], undefined, {}, {
      wedstrijden: [{ ...LOS, matches: wed("m1") }],
    });
    const rij = screen.getByRole("link", { name: /1 wedstrijd/ });
    expect(rij).toHaveClass("speeldag");
    expect(rij.className).not.toMatch(/speeldag--/);
    // Het staafje draagt het statusverschil, zoals bij elke andere status.
    expect(rij.querySelector(".speeldag__rail--past")).toBeInTheDocument();
  });

  it("zet de wedstrijden van een speeldag op die speeldag (#1221)", () => {
    // Eén avond hoort één blok te zijn; een losse rij ernaast over dezelfde
    // wedstrijden zette dezelfde avond er twee keer neer.
    toon([marker({ past: true })], [], undefined, {}, {
      wedstrijdenPerPoll: { "poll-1": 6 },
    });
    expect(screen.getByText("6 wedstrijden")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /wedstrijden/ })).toBeNull();
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

  /* -------- De baanregel houdt zijn ruimte vast (#1233) --------

     De vrije banen en de prijs komen van Playtomic en landen dus ná het
     openen. Stonden ze tussen de chips van groep en club, dan sprong die rij
     naar twee regels en groeide het sheet — dat onderaan verankerd staat —
     omhoog weg onder je vinger. Hoogte valt in jsdom niet te meten; wat hier
     getoetst wordt is de structuur die het mogelijk maakt: de regel staat er
     vóór, tijdens en ná het antwoord, en de chips zitten er niet meer tussen. */

  it("reserveert de baanregel vóór er baaninfo is", () => {
    toon([marker({ status: "open", courts: null, accessCode: null })]);
    expect(document.querySelector(".dagsheet__baan")).toBeInTheDocument();
    // Nog niets ín die regel: het antwoord van Playtomic staat nog open.
    expect(screen.queryByText(/vrij$/)).not.toBeInTheDocument();
  });

  it("houdt de regel staan als het antwoord binnenkomt", async () => {
    toon([marker({ status: "open", courts: null, accessCode: null })]);
    await act(async () => {
      baanAntwoord?.resolve(dagMetVrijeBaan());
    });
    expect(document.querySelector(".dagsheet__baan")).toBeInTheDocument();
    expect(screen.getByText("1 baan vrij")).toBeInTheDocument();
    expect(screen.getByText("± € 7,50 p.p.")).toBeInTheDocument();
    // En niet meer in de rij met groep en club: daar zat de sprong.
    const chips = document.querySelector(".dagsheet__chips");
    expect(chips?.textContent).toBe("Vamos!Padel De Panne");
  });

  it("houdt de regel óók staan als Playtomic niets teruggeeft", async () => {
    toon([marker({ status: "open", courts: null, accessCode: null })]);
    await act(async () => {
      baanAntwoord?.reject(new Error("Playtomic plat"));
    });
    expect(document.querySelector(".dagsheet__baan")).toBeInTheDocument();
    expect(screen.queryByText(/baan vrij/)).not.toBeInTheDocument();
  });

  it("zet de bewaarde telling neer zolang de live-telling onderweg is", async () => {
    toon([
      marker({ status: "open", courts: null, accessCode: null, courtsFree: 3 }),
    ]);
    expect(screen.getByText("3 banen vrij")).toBeInTheDocument();
    // De live-telling vervangt hem stil: dezelfde regel, ander getal.
    await act(async () => {
      baanAntwoord?.resolve(dagMetVrijeBaan());
    });
    expect(screen.getByText("1 baan vrij")).toBeInTheDocument();
    expect(screen.queryByText("3 banen vrij")).not.toBeInTheDocument();
  });

  it("laat de baantelling weg bij een geboekte speeldag naast een open poll", async () => {
    // De opgehaalde data ligt op club en dag, niet op moment: zonder grens
    // vond het geboekte blok de telling van de open poll ernaast en zette
    // "1 baan vrij" neer bij een baan die allang geboekt was.
    toon([
      marker({ startTime: "18:00" }),
      marker({
        optionId: "opt-2",
        pollId: "poll-2",
        status: "open",
        courts: null,
        accessCode: null,
      }),
    ]);
    await act(async () => {
      baanAntwoord?.resolve(dagMetVrijeBaan());
    });
    const blokken = document.querySelectorAll(".dagsheet__speeldag");
    expect(blokken[0].querySelector(".dagsheet__baan")).not.toBeInTheDocument();
    expect(blokken[1].querySelector(".dagsheet__baan")).toBeInTheDocument();
    expect(screen.getAllByText("1 baan vrij")).toHaveLength(1);
  });

  it("reserveert niets bij een dag waar geen baaninfo bij hoort", () => {
    // Geboekt: dan is "is er nog een baan?" geen vraag meer, en er wordt dus
    // ook niets opgehaald. Een lege regel zou daar alleen maar gat zijn.
    toon([marker()]);
    expect(document.querySelector(".dagsheet__baan")).not.toBeInTheDocument();
  });
});
