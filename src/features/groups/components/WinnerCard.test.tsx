import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { Profile } from "@/types";

// De toegangscode-flow (#675) draait om twee API-calls; die mocken we, zodat
// deze test over het gedrag van de kaart gaat en niet over de netwerklaag.
const markPollBooked = vi.hoisted(() => vi.fn(async () => {}));
const setPollAccessCode = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@/features/groups/pollsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/groups/pollsApi")>()),
  markPollBooked,
  setPollAccessCode,
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
};
const PROFILES: Record<string, Profile> = {};

function renderCard(poll: Partial<PlayPoll> = {}) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ul>
          <WinnerCard
            poll={{ ...POLL, ...poll }}
            option={OPTION}
            tally={TALLY}
            perPerson={null}
            club={CLUB}
            groupName="Vrijdagavond padel"
            profiles={PROFILES}
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

describe("<WinnerCard /> toegangscode (#675)", () => {
  beforeEach(() => {
    markPollBooked.mockClear();
    setPollAccessCode.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("'Baan geboekt ✓' vraagt eerst om de code i.p.v. meteen te boeken", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: /baan geboekt/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/toegangscode velden/i)).toBeInTheDocument();
    // Nog niets geboekt zolang de sheet openstaat.
    expect(markPollBooked).not.toHaveBeenCalled();
  });

  it("leeg bevestigen boekt zonder code — overslaan blijft één tik", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: /baan geboekt/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /markeer als geboekt/i }),
    );

    expect(markPollBooked).toHaveBeenCalledWith("poll-1", null);
  });

  it("Enter in het veld bevestigt, met de genormaliseerde code", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: /baan geboekt/i }));
    await userEvent.type(
      screen.getByLabelText(/toegangscode velden/i),
      "  b3: 1234  {Enter}",
    );

    expect(markPollBooked).toHaveBeenCalledWith("poll-1", "b3: 1234");
  });

  it("toont de code in de geboekte staat en kopieert 'm bij een tik", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });

    renderCard({ status: "booked", booked_at: "2026-07-08T12:00:00Z", access_code: "1234" });

    const chip = screen.getByRole("button", { name: /1234/ });
    await userEvent.click(chip);
    expect(writeText).toHaveBeenCalledWith("1234");
  });

  it("stuurt de deellink naar deze speeldag mee in de tekst", async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => {});
    Object.assign(navigator, { share });

    renderCard({ status: "booked", booked_at: "2026-07-08T12:00:00Z", access_code: "1234" });
    await userEvent.click(screen.getByRole("button", { name: /↗ tekst/i }));

    const arg = share.mock.calls[0][0];
    expect(arg.url).toBe(
      `${window.location.origin}/groepen/g1?tab=plannen&poll=poll-1`,
    );
    // De code staat in de tekst zelf — die lees je vóór je verstuurt.
    expect(arg.text).toContain("🔑 Code velden: 1234");
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

    renderCard({ status: "booked", booked_at: "2026-07-08T12:00:00Z", access_code: "b3: 1234" });
    await userEvent.click(screen.getByRole("button", { name: /zet in agenda/i }));

    expect(click).toHaveBeenCalled();
    const ics = await createObjectURL.mock.calls[0][0].text();
    // RFC 5545 escapet de newline tot \n binnen DESCRIPTION.
    expect(ics).toContain("Toegangscode: b3: 1234");
  });

  it("laat de beheerder de code ook ná het boeken nog toevoegen", async () => {
    renderCard({ status: "booked", booked_at: "2026-07-08T12:00:00Z" });

    // Zonder code heet de knop "＋ Code" — de poll hoeft niet heropend te worden.
    await userEvent.click(screen.getByRole("button", { name: /＋ code/i }));
    await userEvent.type(screen.getByLabelText(/toegangscode velden/i), "A12");
    await userEvent.click(screen.getByRole("button", { name: /opslaan/i }));

    expect(setPollAccessCode).toHaveBeenCalledWith("poll-1", "A12");
    expect(markPollBooked).not.toHaveBeenCalled();
  });
});
