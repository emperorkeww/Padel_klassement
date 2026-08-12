import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { GroupSummary } from "@/features/groups/api";
import type {
  PlayPoll,
  PollOption,
  PollVote,
} from "@/features/groups/pollsApi";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});

const setPollVote = vi.fn(() => Promise.resolve());
const clearPollVote = vi.fn(() => Promise.resolve());
vi.mock("@/features/groups/pollsApi", async (orig) => ({
  ...(await orig<typeof import("@/features/groups/pollsApi")>()),
  setPollVote: (...args: unknown[]) => setPollVote(...(args as [])),
  clearPollVote: (...args: unknown[]) => clearPollVote(...(args as [])),
}));

import { StemKaart } from "./StemKaart";
import { sluitTekst } from "../stemMomenten";
import { ToastProvider } from "@/ui/ToastProvider";
import type { OpenPollBundle } from "../dashboardHelpers";

// De stemkaart op het overzicht (#1196): stemmen zonder de pagina te verlaten.
// Welke momenten er staan is getest in stemMomenten.test.ts; hier gaat het om
// wat de kaart toont en wat een tik doet.

const NU = new Date("2026-08-12T10:00:00Z").getTime();

function groep(id: string, name: string): GroupSummary {
  return { id, name } as unknown as GroupSummary;
}

function poll(overrides: Partial<PlayPoll> = {}): PlayPoll {
  return {
    id: "poll-1",
    group_id: "g1",
    created_by: "p1",
    status: "open",
    locked_option_id: null,
    created_at: "2026-08-01T10:00:00Z",
    locked_at: null,
    booked_at: null,
    club_id: "91d8d419-3736-498e-90be-362de786d588",
    club_name: "LAGO CLUB Padel Beveren",
    club_city: "Beveren",
    club_timezone: "Europe/Brussels",
    access_code: null,
    courts: null,
    rounds_generated_at: null,
    ...overrides,
  };
}

function optie(overrides: Partial<PollOption> = {}): PollOption {
  return {
    id: "opt-1",
    poll_id: "poll-1",
    group_id: "g1",
    date: "2026-08-20",
    start_time: "20:00",
    duration: 90,
    courts_free: 2,
    created_at: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

function toon(bundles: OpenPollBundle[], onGestemd = () => {}) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <StemKaart
          bundles={bundles}
          myId="p1"
          now={NU}
          onGestemd={onGestemd}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
}

/** Eén groep met één open poll en zijn momenten. */
function bundel(
  options: PollOption[],
  votes: PollVote[] = [],
  group = groep("g1", "Vrijdagpadel"),
  polls = [poll()],
): OpenPollBundle {
  return { group, polls, options, votes };
}

beforeEach(() => {
  setPollVote.mockClear();
  clearPollVote.mockClear();
});

describe("<StemKaart />", () => {
  it("toont de momenten op volgorde met hun telling", () => {
    toon([
      bundel(
        [
          optie({ id: "o-1", date: "2026-08-20" }),
          optie({ id: "o-2", date: "2026-08-18", start_time: "19:30" }),
        ],
        [
          {
            option_id: "o-2",
            group_id: "g1",
            player_id: "p2",
            status: "yes",
            updated_at: "2026-08-11T10:00:00Z",
          },
        ],
      ),
    ]);

    expect(screen.getByText(/wanneer kan jij\? · vrijdagpadel/i)).toBeInTheDocument();
    const rijen = document.querySelectorAll(".stemrij__wanneer");
    expect([...rijen].map((r) => r.textContent)).toEqual([
      "di 18 aug · 19:30",
      "do 20 aug · 20:00",
    ]);
    expect(screen.getByText("1 kan")).toBeInTheDocument();
  });

  it("stemt ter plekke en meldt dat aan het overzicht", async () => {
    const onGestemd = vi.fn();
    toon([bundel([optie({ id: "o-1" })])], onGestemd);

    await userEvent.click(
      screen.getByRole("button", { name: /ik kan — donderdag 20 augustus 20:00/i }),
    );

    expect(setPollVote).toHaveBeenCalledWith("o-1", "g1", "p1", "yes");
    // Optimistisch: de knop staat meteen aan, zonder op de server te wachten.
    expect(
      screen.getByRole("button", { name: /ik kan — donderdag 20 augustus/i }),
    ).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(onGestemd).toHaveBeenCalled());
  });

  it("wist je stem als je nog eens op dezelfde keuze tikt", async () => {
    toon([
      bundel(
        [optie({ id: "o-1" })],
        [
          {
            option_id: "o-1",
            group_id: "g1",
            player_id: "p1",
            status: "yes",
            updated_at: "2026-08-11T10:00:00Z",
          },
        ],
      ),
    ]);

    await userEvent.click(screen.getByRole("button", { name: /^ik kan —/i }));

    expect(clearPollVote).toHaveBeenCalledWith("o-1", "p1");
    expect(setPollVote).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^ik kan —/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("rolt de knop terug als de stem niet landt", async () => {
    setPollVote.mockRejectedValueOnce(new Error("offline"));
    toon([bundel([optie({ id: "o-1" })])]);

    const knop = screen.getByRole("button", { name: /^ik kan —/i });
    await userEvent.click(knop);

    await waitFor(() => expect(knop).toHaveAttribute("aria-pressed", "false"));
    expect(await screen.findByText(/offline/i)).toBeInTheDocument();
  });

  it("zet de groepsnaam per rij zodra er twee groepen in beeld staan", () => {
    toon([
      bundel([optie({ id: "o-1" })]),
      bundel(
        [optie({ id: "o-2", poll_id: "poll-2", group_id: "g2", date: "2026-08-18" })],
        [],
        groep("g2", "Dinsdagclub"),
        [poll({ id: "poll-2", group_id: "g2" })],
      ),
    ]);

    expect(screen.getByText("Dinsdagclub")).toBeInTheDocument();
    expect(screen.getByText("Vrijdagpadel")).toBeInTheDocument();
    // Twee polls → geen enkele juiste speeldag om heen te linken.
    expect(screen.getByRole("link", { name: /naar de agenda/i })).toHaveAttribute(
      "href",
      "/agenda",
    );
  });

  it("blijft staan als je overal op gestemd hebt, met een rustige kop", () => {
    toon([
      bundel(
        [optie({ id: "o-1" })],
        [
          {
            option_id: "o-1",
            group_id: "g1",
            player_id: "p1",
            status: "no",
            updated_at: "2026-08-11T10:00:00Z",
          },
        ],
      ),
    ]);

    expect(screen.getByText(/je stem staat genoteerd/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^kan niet —/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("waarschuwt wanneer er binnenkort automatisch beslist wordt", () => {
    // 20:00 Brussel vanavond is 18:00Z; de auto-lock ligt om 06:00Z, dus vier
    // uur vóór het nu van deze test.
    toon([
      bundel([optie({ id: "o-vanavond", date: "2026-08-12", start_time: "20:00" })]),
    ]);
    expect(screen.getByText(/er wordt zo beslist/i)).toBeInTheDocument();
  });

  it("toont niets zonder moment om over te stemmen", () => {
    // De ToastProvider zet altijd zijn eigen live-regions neer; het gaat erom
    // dat de kaart zelf wegblijft.
    const { container } = toon([bundel([])]);
    expect(container.querySelector(".stemkaart")).toBeNull();
  });
});

describe("sluitTekst", () => {
  it("zwijgt zolang het niet dringend is", () => {
    expect(sluitTekst(null, NU)).toBeNull();
  });

  it("telt af in uren en wordt daarna dringend", () => {
    expect(sluitTekst(NU + 5 * 3600_000, NU)).toBe("Sluit over 5 uur.");
    expect(sluitTekst(NU + 20 * 60_000, NU)).toBe("Sluit binnen het uur.");
    expect(sluitTekst(NU - 60_000, NU)).toBe("Er wordt zo beslist.");
  });
});
