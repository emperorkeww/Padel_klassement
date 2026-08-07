import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { GroupMember, Profile } from "@/types";

const NOW = "2026-07-08T10:00:00.000Z";

const tables = vi.hoisted(() => ({}) as Record<string, unknown[]>);

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { PollCard } from "./PollCard";
import { GROUP_MEMBERS, PROFILES } from "@/test/fixtures";
import type { PlayPoll, PollOption } from "@/features/groups/pollsApi";

const profileMap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

const bookedPoll = {
  id: "poll-1",
  group_id: "g1",
  created_by: "p1",
  status: "booked",
  locked_option_id: "opt-1",
  created_at: NOW,
  locked_at: NOW,
  booked_at: "2026-07-08T12:00:00.000Z",
  club_id: "91d8d419-3736-498e-90be-362de786d588",
  club_name: "LAGO CLUB Padel Beveren",
  club_city: "Beveren",
  club_timezone: "Europe/Brussels",
  access_code: null,
  courts: "3",
  rounds_generated_at: null,
} as PlayPoll;

const option = {
  id: "opt-1",
  poll_id: "poll-1",
  group_id: "g1",
  date: "2030-01-10",
  start_time: "19:00",
  duration: 90,
  courts_free: 2,
  created_at: NOW,
} as PollOption;

/** Vangt de blob die downloadIcs aanbiedt, zodat de test in het bestand kan
 *  kijken zonder de helper te mocken. */
function vangDownload(): { tekst: () => Promise<string> } {
  let blob: Blob | null = null;
  vi.stubGlobal("URL", {
    createObjectURL: (b: Blob) => {
      blob = b;
      return "blob:fake";
    },
    revokeObjectURL: () => {},
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  return { tekst: async () => (blob ? await blob.text() : "") };
}

function renderCard(poll: PlayPoll) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <PollCard
          poll={poll}
          groupName="Vrijdagavond padel"
          members={GROUP_MEMBERS as GroupMember[]}
          options={[option]}
          votes={[]}
          profiles={profileMap}
          myId="p1"
          isOwner
          onChanged={() => {}}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("<PollCard /> — speeldag uit de agenda halen (#1099)", () => {
  beforeEach(() => {
    tables.play_polls = [bookedPoll];
    tables.play_poll_options = [option];
    tables.play_poll_votes = [];
    // De baanbeschikbaarheid loopt via fetch; leeg antwoord volstaat hier.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("biedt op een geannuleerde speeldag een bestand aan dat de afspraak wist", async () => {
    const download = vangDownload();
    renderCard({ ...bookedPoll, status: "cancelled" });

    await userEvent.click(
      await screen.findByRole("button", { name: /haal uit je agenda/i }),
    );

    const ics = await download.tekst();
    expect(ics).toContain("STATUS:CANCELLED");
    // Dezelfde UID als het event dat de agenda ooit binnenkwam: zonder die
    // match wist de annulering niets.
    expect(ics).toContain("UID:speeldag-poll-1@vamos-padel");
    expect(ics).toContain("DTSTART;TZID=Europe/Brussels:20300110T190000");
  });

  it("biedt datzelfde bestand meteen aan wanneer je de speeldag annuleert", async () => {
    const download = vangDownload();
    renderCard(bookedPoll);

    // Een geboekte kaart opent dichtgeklapt (#1141); annuleren hoort bij de
    // details, niet bij de twee acties die overblijven.
    await userEvent.click(
      await screen.findByRole("button", { name: /details/i }),
    );
    const knop = await screen.findByRole("button", {
      name: /annuleer speeldag/i,
    });
    await userEvent.click(knop); // eerste tik = bevestigen
    await userEvent.click(
      screen.getByRole("button", { name: /zeker\? tik nogmaals/i }),
    );

    await waitFor(async () =>
      expect(await download.tekst()).toContain("STATUS:CANCELLED"),
    );
  });

  it("laat een open poll met rust: daar staat niets in iemands agenda", async () => {
    renderCard({
      ...bookedPoll,
      status: "open",
      locked_option_id: null,
      locked_at: null,
      booked_at: null,
    });

    await screen.findByRole("button", { name: /annuleer poll/i });
    expect(
      screen.queryByRole("button", { name: /haal uit je agenda/i }),
    ).not.toBeInTheDocument();
  });
});

// De kaart hield na het boeken elke fase open — deelnemers, twijfelaars,
// boekgegevens, agenda, deelvinkjes, generator — terwijl alles waarvoor je de
// pagina opende (de wedstrijden) daaronder stond.
describe("<PollCard /> — geboekte speeldag klapt dicht (#1141)", () => {
  beforeEach(() => {
    tables.play_polls = [bookedPoll];
    tables.play_poll_options = [option];
    tables.play_poll_votes = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("toont dicht alleen het moment, de baan en de twee acties", async () => {
    renderCard(bookedPoll);

    // Wat je aan de deur nodig hebt blijft staan.
    expect(
      await screen.findByText(/donderdag 10 januari/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Baan 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /🖼 delen/i })).toBeInTheDocument();

    // De rest niet: die staat achter "Details".
    expect(
      screen.queryByRole("heading", { name: /^boeken$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /annuleer speeldag/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /wijzig baan & code/i }),
    ).not.toBeInTheDocument();
  });

  it("geeft met Details alles terug", async () => {
    renderCard(bookedPoll);

    await userEvent.click(
      await screen.findByRole("button", { name: /details ⌄/i }),
    );

    expect(
      screen.getByRole("heading", { name: /^boeken$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /wijzig baan & code/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /annuleer speeldag/i }),
    ).toBeInTheDocument();
  });

  // Zolang er nog gekozen of geboekt wordt valt er niets weg te vouwen.
  it("laat een poll die nog loopt gewoon openstaan", async () => {
    renderCard({
      ...bookedPoll,
      status: "locked",
      booked_at: null,
    });

    await screen.findByRole("heading", { name: /^boeken$/i });
    expect(
      screen.queryByRole("button", { name: /details/i }),
    ).not.toBeInTheDocument();
  });
});
