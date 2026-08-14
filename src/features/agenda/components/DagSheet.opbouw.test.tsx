import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { AgendaMarker } from "../agendaLogic";
import type { Profile } from "@/types";

/* #1308 — de beslissing bovenaan, de acties in één balk.
 *
 * Het sheet zette de stemrij — het enige wat je hier zelf kunt afmaken — onder
 * twee namenlijsten, en de enige accentknop eronder ("Open speeldag")
 * navigeert juist wég. In een groep van twintig lag de stemrij daardoor onder
 * de vouw op 390×844.
 *
 * Bij een geboekte speeldag was er hélemaal geen handeling: "Nog 2 bevestigde
 * spelers nodig" zonder enige manier om er een te worden — afmelden kon alleen
 * op de speeldagpagina.
 */

const presence = vi.hoisted(() => ({
  getAanwezigheid: vi.fn(async () => ({}) as Record<string, boolean>),
  zetMijnAanwezigheid: vi.fn(async () => {}),
  zetAanwezigheid: vi.fn(async () => {}),
}));
vi.mock("@/features/groups/aanwezigheidApi", () => presence);

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});

vi.mock("@/features/availability/api", async (orig) => ({
  ...(await orig<typeof import("@/features/availability/api")>()),
  // Blijft hangen: zo staat het sheet in de toestand waarin je hem het eerst
  // ziet, en de baanregel is hier niet het onderwerp.
  getClubAvailability: () => new Promise(() => {}),
}));

import { DagSheet } from "./DagSheet";

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
    status: "open",
    past: false,
    iVoted: false,
    myVote: null,
    voterCount: 0,
    yesVoterIds: [],
    maybeVoterIds: [],
    noVoterIds: [],
    nietGereageerdIds: [],
    nietGestemdIds: [],
    courts: null,
    accessCode: null,
    courtsFree: null,
    changedAt: "2026-08-01T18:00:00.000Z",
    ...overrides,
  };
}

function toon(markers: AgendaMarker[], onPlan?: () => void) {
  render(
    <MemoryRouter>
      <ToastProvider>
        <DagSheet
          datum="2026-08-13"
          markers={markers}
          momentenPerPoll={{ "poll-1": markers }}
          ledenPerGroep={{ g1: 8 }}
          profielen={{}}
          myId="me"
          onGestemd={vi.fn()}
          onPlan={onPlan}
          onClose={vi.fn()}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
}

/** Waar staat dit blok in de leesvolgorde van het sheet? */
function positie(selector: string): number {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`niet gevonden: ${selector}`);
  return [...document.querySelectorAll("*")].indexOf(el);
}

describe("<DagSheet /> — opbouw (#1308)", () => {
  beforeEach(() => {
    presence.getAanwezigheid.mockClear();
    presence.zetMijnAanwezigheid.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("zet jouw stem boven de namen en de cijfers", () => {
    toon([marker({ nietGereageerdIds: ["p2"] })]);
    expect(positie(".dagsheet__stemmen")).toBeLessThan(
      positie(".dagsheet__deelname"),
    );
    expect(positie(".dagsheet__stemmen")).toBeLessThan(
      positie(".dagsheet__meta"),
    );
  });

  it("vouwt de namen op achter de telling", async () => {
    toon([marker({ yesVoterIds: ["p2"], nietGereageerdIds: ["p3"] })]);
    const blok = document.querySelector(".dagsheet__deelname");
    expect(blok?.tagName).toBe("DETAILS");
    // De telling en de gezichten blijven staan, de namen gaan erachter.
    expect(blok?.querySelector("summary")?.textContent).toContain(
      "Wie doet er mee — 1 van 8",
    );
    expect(
      blok?.querySelector("summary")?.textContent?.includes("Nog niets gezegd"),
    ).toBe(false);
    expect(
      document.querySelector(".dagsheet__namen")?.textContent,
    ).toContain("Nog niets gezegd");
  });

  it("noemt de deelnemers bij naam, niet alleen als gezicht", () => {
    // Zes initialen naast elkaar zijn op een telefoon niet uit elkaar te
    // houden, en bij twee mensen met dezelfde voorletter helpt een foto ook
    // niet. Wie meedoet staat dus ook uitgeschreven.
    const namen = {
      p2: { id: "p2", username: "bob", full_name: "Bob Boers", avatar_url: null, created_at: "2026-01-01T00:00:00Z" },
      p3: { id: "p3", username: "carol", full_name: "Carol Claes", avatar_url: null, created_at: "2026-01-01T00:00:00Z" },
    } as unknown as Record<string, Profile>;
    render(
      <MemoryRouter>
        <ToastProvider>
          <DagSheet
            datum="2026-08-13"
            markers={[marker({ status: "booked", yesVoterIds: ["p2", "p3"] })]}
            momentenPerPoll={{}}
            ledenPerGroep={{ g1: 8 }}
            profielen={namen}
            myId="me"
            onGestemd={vi.fn()}
            onClose={vi.fn()}
          />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(
      document.querySelector(".dagsheet__namen")?.textContent,
    ).toContain("Bob Boers, Carol Claes");
  });

  it("zet de namen meteen open zodra de speeldag vastligt", () => {
    // Dan is "wie komt er" de hoofdvraag van dit sheet. Bij een open stemming
    // gaat het eerst om jouw eigen antwoord en blijven ze achter de rij.
    toon([marker({ status: "booked", yesVoterIds: ["p2"] })]);
    expect(document.querySelector(".dagsheet__deelname")).toHaveAttribute("open");
  });

  it("houdt de namen ingeklapt zolang er gestemd wordt", () => {
    toon([marker({ yesVoterIds: ["p2"] })]);
    expect(
      document.querySelector(".dagsheet__deelname"),
    ).not.toHaveAttribute("open");
  });

  /* ---- De indeling wint zodra de speeldag vastligt (#1308) ---- */

  const PLOEG = Object.fromEntries(
    [
      ["p2", "Bob Boers"],
      ["p3", "Carol Claes"],
      ["p4", "Dave De Vos"],
    ].map(([id, naam]) => [
      id,
      { id, username: id, full_name: naam, avatar_url: null, created_at: "2026-01-01T00:00:00Z" },
    ]),
  ) as unknown as Record<string, Profile>;

  function toonPloeg(m: AgendaMarker) {
    render(
      <MemoryRouter>
        <ToastProvider>
          <DagSheet
            datum="2026-08-13"
            markers={[m]}
            momentenPerPoll={{}}
            ledenPerGroep={{ g1: 8 }}
            profielen={PLOEG}
            myId="me"
            onGestemd={vi.fn()}
            onClose={vi.fn()}
          />
        </ToastProvider>
      </MemoryRouter>,
    );
  }

  it("telt wie de organisator erbij zette mee in de indeling", async () => {
    // De indeling is de ja-lijst mét de correcties uit play_poll_presence —
    // dezelfde regel als waarmee de teams gemaakt worden. Wie erbij gezet was
    // stond nergens in dit sheet, terwijl de regel eronder hem "Je staat in de
    // indeling" beloofde.
    presence.getAanwezigheid.mockResolvedValue({ p4: true });
    toonPloeg(
      marker({ status: "booked", yesVoterIds: ["p2"], noVoterIds: ["p4"] }),
    );

    expect(
      await screen.findByText("Bob Boers, Dave De Vos"),
    ).toBeInTheDocument();
    expect(screen.getByText("Doet mee")).toBeInTheDocument();
    // En niet dubbel: zijn nee-stem telt niet meer mee nu hij is toegevoegd.
    expect(screen.queryByText("Kan niet")).not.toBeInTheDocument();
  });

  it("haalt wie eruit gehaald is uit de indeling", async () => {
    presence.getAanwezigheid.mockResolvedValue({ p3: false });
    toonPloeg(
      marker({ status: "booked", yesVoterIds: ["p2", "p3"] }),
    );

    expect(await screen.findByText("Bob Boers")).toBeInTheDocument();
    expect(screen.getByText("Kan niet")).toBeInTheDocument();
    expect(screen.getByText("Carol Claes")).toBeInTheDocument();
    expect(screen.getByText("Wie doet er mee — 1 van 8")).toBeInTheDocument();
  });

  it("noemt de rij 'Ik kan' zolang er nog gestemd wordt", () => {
    // Dan bestaat er nog geen indeling om van af te wijken.
    toonPloeg(marker({ yesVoterIds: ["p2"] }));
    expect(screen.getByText("Ik kan")).toBeInTheDocument();
    expect(presence.getAanwezigheid).not.toHaveBeenCalled();
  });

  it("zet de acties in een plakkende voetbalk, primair rechts", () => {
    toon([marker({ status: "booked", courts: "3 & 4" })]);
    const voet = document.querySelector(".dagsheet__voet");
    expect(voet).toBeInTheDocument();
    // Zelfde vorm als het match-sheet (#1144).
    expect(voet).toHaveClass("sheet__foot", "glas", "glas--balk");
    const knoppen = [...(voet?.querySelectorAll("a, button") ?? [])].map(
      (e) => e.textContent,
    );
    expect(knoppen).toEqual(["Zet in je agenda", "Open speeldag"]);
    // En het sheet houdt onderaan geen eigen padding, anders schemert de
    // inhoud onder de balk door.
    expect(document.querySelector(".sheet--dag")).toBeInTheDocument();
  });

  it("houdt de acties ín het blok bij twee speeldagen op één dag", () => {
    // Eén plakbalk kan niet over twee speeldagen gaan.
    toon([marker(), marker({ optionId: "opt-2", pollId: "poll-2" })]);
    expect(document.querySelector(".dagsheet__voet")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".dagsheet__acties")).toHaveLength(2);
  });

  it("houdt 'plan hier ook' lichter dan de hoofdactie", () => {
    toon([marker()], vi.fn());
    const knop = screen.getByRole("button", {
      name: "Plan hier ook een speeldag",
    });
    // Dezelfde pilvorm als elke andere secundaire actie in de app (#1308),
    // maar zonder het accent van "Open speeldag" in de voetbalk.
    expect(knop).toHaveClass("btn", "btn--sm");
    expect(knop).not.toHaveClass("btn--primary");
    expect(positie(".dagsheet__ookplannen")).toBeLessThan(
      positie(".dagsheet__voet"),
    );
  });

  /* ---- Afmelden bij een vastgelegde speeldag (#1271, hier sinds #1308) ---- */

  it("laat je je afmelden voor een geboekte speeldag", async () => {
    // "me" stemde ja, dus staat in de indeling.
    toon([marker({ status: "booked", myVote: "yes", yesVoterIds: ["me"] })]);
    await userEvent.click(
      await screen.findByRole("button", { name: "Ik kan toch niet" }),
    );
    expect(presence.zetMijnAanwezigheid).toHaveBeenCalledWith(
      "opt-1",
      "g1",
      "me",
      false,
    );
    expect(screen.getByText("Je staat niet in de indeling.")).toBeInTheDocument();
  });

  it("vraagt niet af te melden bij een speeldag waar je niet bij staat", async () => {
    // De indeling begint bij de ja-stemmers; stemde je nee (of niets), dan sta
    // je er niet bij — en dan is "Ik kan toch niet" een knop over iets wat al
    // zo is. Meedoen kan wél: dat is precies de uitweg die ontbrak.
    toon([marker({ status: "booked", myVote: "no", noVoterIds: ["me"] })]);
    expect(
      await screen.findByRole("button", { name: "Toch meedoen" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ik kan toch niet" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Je staat niet in de indeling.")).toBeInTheDocument();
  });

  it("biedt geen afmeldknop zolang er nog gestemd wordt", () => {
    // Zolang de poll open is, is jouw stem het antwoord — niet presence.
    toon([marker()]);
    expect(
      screen.queryByRole("button", { name: "Ik kan toch niet" }),
    ).not.toBeInTheDocument();
  });
});
