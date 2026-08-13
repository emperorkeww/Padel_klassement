import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { Profile } from "@/types";

// #1271 — je kon je niet afmelden nadat het moment vaststond.
//
// Stemmen kan alleen zolang de poll open is (`votable`), dus wie ná het
// vastleggen afhaakte kon dat nergens zeggen. De organisator zette het in zijn
// eigen browser (localStorage), een tweede organisator zag dat niet, en de
// speler zelf zag zich gewoon in de opstelling staan. Nu is er één knop, en die
// schrijft naar dezelfde bron waaruit de indeling put.

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

import { WinnerCard } from "./WinnerCard";
import type { PlayPoll, PollOption } from "@/features/groups/pollsApi";
import type { OptionTally } from "@/features/groups/pollLogic";

const CLUB = {
  id: "",
  name: "Sporthal De Kaai",
  city: "Beveren",
  timezone: "Europe/Brussels",
};

const POLL = {
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
  deadline_notified_at: null,
  dayof_notified_at: null,
  rounds_generated_at: null,
} as unknown as PlayPoll;

const OPTION = {
  id: "opt-1",
  poll_id: "poll-1",
  group_id: "g1",
  date: "2026-07-10",
  start_time: "20:00",
  duration: 90,
  courts_free: 2,
  created_at: "2026-07-08T10:00:00Z",
} as unknown as PollOption;

const TALLY: OptionTally = {
  yes: ["p1", "p2"],
  maybe: [],
  no: [],
  needed: 1,
  enoughPlayers: false,
  mee: 2,
  tekort: 2,
};

function toon(poll: Partial<PlayPoll> = {}) {
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
            profiles={{} as Record<string, Profile>}
            myId="p2"
            isManager={false}
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

describe("<WinnerCard /> afmelden (#1271)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presence.getAanwezigheid.mockResolvedValue({});
  });

  it("laat een deelnemer zich afmelden bij een vastgelegd moment", async () => {
    toon();
    await userEvent.click(
      await screen.findByRole("button", { name: /ik kan toch niet/i }),
    );
    expect(presence.zetMijnAanwezigheid).toHaveBeenCalledWith(
      "opt-1",
      "g1",
      "p2",
      false,
    );
  });

  it("werkt ook als de baan al geboekt is", async () => {
    // Juist dan haakt er iemand af: het moment staat vast, de agenda-uitnodiging
    // is rond, en dán blijkt je zoon te moeten voetballen.
    toon({ status: "booked", booked_at: "2026-07-08T12:00:00Z" });
    expect(
      await screen.findByRole("button", { name: /ik kan toch niet/i }),
    ).toBeInTheDocument();
  });

  it("haalt de rij weg bij 'toch weer mee' in plaats van een ja te schrijven", async () => {
    // Anders zou een latere intrekking van je ja-stem geen effect meer hebben.
    presence.getAanwezigheid.mockResolvedValue({ p2: false });
    toon();
    await userEvent.click(
      await screen.findByRole("button", { name: /toch weer mee/i }),
    );
    expect(presence.zetMijnAanwezigheid).toHaveBeenCalledWith(
      "opt-1",
      "g1",
      "p2",
      null,
    );
  });

  it("zegt erbij wat een afmelding betekent", async () => {
    presence.getAanwezigheid.mockResolvedValue({ p2: false });
    toon();
    expect(
      await screen.findByText(/je staat niet in de indeling/i),
    ).toBeInTheDocument();
  });
});
