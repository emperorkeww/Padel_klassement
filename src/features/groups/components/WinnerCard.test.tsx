import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { Profile } from "@/types";

// De boek-flow (#675, #802) draait om twee API-calls; die mocken we, zodat
// deze test over het gedrag van de kaart gaat en niet over de netwerklaag.
const markPollBooked = vi.hoisted(() => vi.fn(async () => {}));
const setPollBookingDetails = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@/features/groups/pollsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/groups/pollsApi")>()),
  markPollBooked,
  setPollBookingDetails,
}));

import { WinnerCard } from "./WinnerCard";
import type { PlayPoll, PollOption } from "@/features/groups/pollsApi";
import type { OptionTally } from "@/features/groups/pollLogic";

// Handmatige locatie (leeg club_id): geen Playtomic, dus geen boek-anchor en
// geen slug-fetch in deze test.
const CLUB = { id: "", name: "Sporthal De Kaai", city: "Beveren", timezone: "Europe/Brussels" };

const POLL: PlayPoll = {
  id: "poll-1",
  group_id: "g1",
  created_by: "p1",
  status: "locked",
  locked_option_id: "opt-1",
  created_at: "2026-07-08T10:00:00Z",
  locked_at: "2026-07-08T11:00:00Z",
  booked_at: null,
  club_id: "",
  club_name: "Sporthal De Kaai",
  club_city: "Beveren",
  club_timezone: "Europe/Brussels",
  access_code: null,
  courts: null,
  rounds_generated_at: null,
};

const OPTION: PollOption = {
  id: "opt-1",
  poll_id: "poll-1",
  group_id: "g1",
  date: "2030-01-10",
  start_time: "20:00",
  duration: 90,
  courts_free: 2,
  created_at: "2026-07-08T10:00:00Z",
};

const TALLY: OptionTally = {
  yes: ["p1", "p2"],
  maybe: [],
  no: [],
  needed: 1,
  enoughPlayers: false,
  mee: 2,
  tekort: 2,
};
const PROFILES: Record<string, Profile> = {};

function renderCard(
  poll: Partial<PlayPoll> = {},
  extra: {
    tally?: OptionTally;
    profiles?: Record<string, Profile>;
  } = {},
) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ul>
          <WinnerCard
            poll={{ ...POLL, ...poll }}
            option={OPTION}
            tally={extra.tally ?? TALLY}
            perPerson={null}
            club={CLUB}
            groupName="Vrijdagavond padel"
            profiles={extra.profiles ?? PROFILES}
            myId="p1"
            isManager
            busy={false}
            run={async (fn) => {
              await fn();
            }}
          />
        </ul>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const originalCreateElement = document.createElement;

describe("<WinnerCard /> banen & toegangscode (#675, #802)", () => {
  beforeEach(() => {
    markPollBooked.mockClear();
    setPollBookingDetails.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("'Baan geboekt ✓' vraagt eerst om baan en code i.p.v. meteen te boeken", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: /baan geboekt/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/^banen$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toegangscode velden/i)).toBeInTheDocument();
    // Nog niets geboekt zolang de sheet openstaat.
    expect(markPollBooked).not.toHaveBeenCalled();
  });

  it("leeg bevestigen boekt zonder baan of code — overslaan blijft één tik", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: /baan geboekt/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /markeer als geboekt/i }),
    );

    expect(markPollBooked).toHaveBeenCalledWith("poll-1", {
      courts: null,
      accessCode: null,
    });
  });

  it("Enter in het veld bevestigt, met genormaliseerde banen en code", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: /baan geboekt/i }));
    await userEvent.type(screen.getByLabelText(/^banen$/i), "  3 &  4  ");
    await userEvent.type(
      screen.getByLabelText(/toegangscode velden/i),
      "  b3: 1234  {Enter}",
    );

    expect(markPollBooked).toHaveBeenCalledWith("poll-1", {
      courts: "3 & 4",
      accessCode: "b3: 1234",
    });
  });

  it("toont de geboekte banen in de geboekte staat", async () => {
    renderCard({
      status: "booked",
      booked_at: "2026-07-08T12:00:00Z",
      courts: "3 & 4",
    });

    expect(screen.getByText("Baan 3 & 4")).toBeInTheDocument();
  });

  it("toont de code in de geboekte staat en kopieert 'm bij een tik", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });

    renderCard({ status: "booked", booked_at: "2026-07-08T12:00:00Z", access_code: "1234" });

    // Dát een tik de code kopieert stond alleen in een title-tooltip (#924):
    // op touch onbereikbaar. Het zit nu in de naam van de knop.
    const chip = screen.getByRole("button", {
      name: /toegangscode 1234 kopiëren/i,
    });
    await userEvent.click(chip);
    expect(writeText).toHaveBeenCalledWith("1234");
  });

  it("stuurt de deellink naar deze speeldag mee in de tekst", async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => {});
    Object.assign(navigator, { share });

    renderCard({
      status: "booked",
      booked_at: "2026-07-08T12:00:00Z",
      access_code: "1234",
      courts: "3 & 4",
    });
    // Delen zit sinds #1141 achter één knop, met de opt-ins in de sheet.
    await userEvent.click(screen.getByRole("button", { name: /🖼 delen/i }));
    await userEvent.click(screen.getByRole("button", { name: /↗ tekst/i }));

    const arg = share.mock.calls[0][0];
    expect(arg.url).toBe(
      `${window.location.origin}/speeldag/poll-1`,
    );
    // De code staat in de tekst zelf — die lees je vóór je verstuurt.
    expect(arg.text).toContain("🔑 Code velden: 1234");
    // En de baan staat in de geboekt-regel: dat is wat er nu nagevraagd wordt.
    expect(arg.text).toContain("✅ Geboekt — Baan 3 & 4 — tot dan!");
  });

  it("zet de code in de description van het agenda-item", async () => {
    // De ICS is een persoonlijke download; de code staat daarmee in je agenda
    // op het moment dat je hem nodig hebt.
    const anchor = document.createElement("a");
    const click = vi.spyOn(anchor, "click").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
      tag === "a" ? anchor : originalCreateElement.call(document, tag),
    );
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:test");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });

    renderCard({
      status: "booked",
      booked_at: "2026-07-08T12:00:00Z",
      access_code: "b3: 1234",
      courts: "3 & 4",
    });
    await userEvent.click(screen.getByRole("button", { name: /🖼 delen/i }));
    await userEvent.click(screen.getByRole("button", { name: /zet in agenda/i }));

    expect(click).toHaveBeenCalled();
    const ics = await createObjectURL.mock.calls[0][0].text();
    expect(ics).toContain("Toegangscode b3: 1234");
    expect(ics).toContain("Baan 3 & 4");
    // De baan hoort ook bij de locatie: die staat in de agendamelding zelf.
    expect(ics).toContain("LOCATION:Sporthal De Kaai · Baan 3 & 4");
    // Sinds #1121 dezelfde UID als "haal uit je agenda" (speeldagIcs): met een
    // eigen UID wiste een annulering dit item nooit.
    expect(ics).toContain("UID:speeldag-poll-1@vamos-padel");
  });

  it("laat de beheerder baan en code ook ná het boeken nog toevoegen", async () => {
    renderCard({ status: "booked", booked_at: "2026-07-08T12:00:00Z" });

    // Nog niets ingevuld: "＋ Baan & code" — de poll hoeft niet heropend.
    await userEvent.click(screen.getByRole("button", { name: /＋ baan & code/i }));
    await userEvent.type(screen.getByLabelText(/^banen$/i), "Center Court");
    await userEvent.type(screen.getByLabelText(/toegangscode velden/i), "A12");
    await userEvent.click(screen.getByRole("button", { name: /opslaan/i }));

    expect(setPollBookingDetails).toHaveBeenCalledWith("poll-1", {
      courts: "Center Court",
      accessCode: "A12",
    });
    expect(markPollBooked).not.toHaveBeenCalled();
  });
});

// ── Klaarzetten (#1146) ──────────────────────────────────────────────
// De kaart had een eigen Elo-generator (#727), daarna een slot voor de knop
// van de pagina (#1141). Nu staat het speelformaat-paneel open op de pagina
// zelf, dus de kaart heeft er niets meer over te zeggen.

const ACHT_YES: OptionTally = {
  yes: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
  maybe: [],
  no: [],
  needed: 2,
  enoughPlayers: true,
  mee: 8,
  tekort: 0,
};

const GEBOEKT = { status: "booked" as const, booked_at: "2026-07-08T12:00:00Z" };

describe("<WinnerCard /> delen & agenda (#1141)", () => {
  // Twee knoppen, twee vinkjes en een agenda-knop stonden open in de kaart:
  // vijf regels waarvan de vinkjes het meeste gewicht droegen. Achter één knop
  // krijgen de keuzes juist ruimte om uit te leggen wat ze doen.
  it("zet delen, de poster-opt-ins en de agenda-export in één sheet", async () => {
    renderCard({
      status: "booked",
      booked_at: "2026-07-08T12:00:00Z",
      access_code: "1234",
    });

    // Dicht in de kaart: alleen de knop.
    expect(
      screen.queryByRole("button", { name: /↗ tekst/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /🖼 delen/i }));
    const sheet = await screen.findByRole("dialog", { name: /delen & agenda/i });

    expect(
      within(sheet).getByRole("button", { name: /↗ tekst/i }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: /🖼 afbeelding/i }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("checkbox", { name: /toegangscode op de poster/i }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("checkbox", { name: /qr naar de speeldag/i }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: /zet in agenda/i }),
    ).toBeInTheDocument();
  });
});

describe("<WinnerCard /> klaarzetten (#1146)", () => {
  it("laat het indelen aan de pagina", () => {
    renderCard(GEBOEKT, { tally: ACHT_YES });

    expect(
      screen.queryByRole("heading", { name: /klaarzetten/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /wedstrijden klaarzetten/i }),
    ).not.toBeInTheDocument();
  });
});

// De gekozen speeldag toonde enkel de zekere spelers, terwijl "nog 1 speler
// nodig" juist vraagt: wie twijfelt er nog?
describe("<WinnerCard /> misschien-stemmers (#803)", () => {
  const profiel = (id: string, naam: string): Profile => ({
    id,
    username: naam.toLowerCase(),
    full_name: naam,
    avatar_url: null,
    created_at: "2026-01-01T00:00:00Z",
  });
  const PROFIELEN = {
    p1: profiel("p1", "Ann"),
    p3: profiel("p3", "Bert"),
    p4: profiel("p4", "Cis"),
  };

  it("noemt de twijfelaars bij naam onder de deelnemers", () => {
    renderCard(
      {},
      {
        tally: { ...TALLY, yes: ["p1"], maybe: ["p3", "p4"] },
        profiles: PROFIELEN,
      },
    );

    expect(screen.getByText(/misschien: bert, cis/i)).toBeInTheDocument();
  });

  it("zwijgt zodra niemand twijfelt", () => {
    renderCard({}, { tally: { ...TALLY, yes: ["p1"] }, profiles: PROFIELEN });

    expect(screen.queryByText(/misschien:/i)).not.toBeInTheDocument();
  });
});
