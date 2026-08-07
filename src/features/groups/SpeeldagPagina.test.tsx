import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";

const NOW = "2026-07-08T10:00:00.000Z";

// Muteerbare tabellen, zoals PlanTab.test: elke test zet zijn eigen situatie
// neer. vi.hoisted, want de mock-factory hieronder wordt boven de imports
// gehesen.
const tables = vi.hoisted(() => ({}) as Record<string, unknown[]>);

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "p1" } }),
}));

import { SpeeldagPagina } from "./SpeeldagPagina";
import { GROUP_MEMBERS, GROUPS, PROFILES } from "@/test/fixtures";

const baseClub = {
  club_id: "91d8d419-3736-498e-90be-362de786d588",
  club_name: "LAGO CLUB Padel Beveren",
  club_city: "Beveren",
  club_timezone: "Europe/Brussels",
};

const openPoll = {
  id: "poll-open",
  group_id: "g1",
  created_by: "p1",
  status: "open",
  locked_option_id: null,
  created_at: NOW,
  locked_at: null,
  booked_at: null,
  courts: null,
  access_code: null,
  ...baseClub,
};

const openOption = {
  id: "opt-open",
  poll_id: "poll-open",
  group_id: "g1",
  date: "2030-01-05",
  start_time: "20:00",
  duration: 90,
  courts_free: 2,
  created_at: NOW,
};

const bookedPoll = {
  ...openPoll,
  id: "poll-booked",
  status: "booked",
  locked_option_id: "opt-booked",
  locked_at: NOW,
  booked_at: "2026-07-08T12:00:00.000Z",
  courts: "3 & 4",
  access_code: "1234",
};

const bookedOption = {
  ...openOption,
  id: "opt-booked",
  poll_id: "poll-booked",
  date: "2030-01-10",
  start_time: "19:00",
};

const vote = (optionId: string, playerId: string, status = "yes") => ({
  option_id: optionId,
  group_id: "g1",
  player_id: playerId,
  status,
  updated_at: NOW,
});

/** De baanbeschikbaarheid loopt via de Playtomic-proxy; leeg volstaat hier. */
function stubPlaytomic() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const body = String(input).includes("/v1/tenants/")
        ? {
            resources: [],
            opening_hours: {},
            address: { timezone: "Europe/Brussels" },
          }
        : [];
      return { ok: true, status: 200, json: async () => body } as Response;
    }),
  );
}

function renderPagina(pollId: string) {
  return render(
    <MemoryRouter initialEntries={[`/speeldag/${pollId}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/speeldag/:id" element={<SpeeldagPagina />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

// De supabase-mock filtert niet op `eq`: `maybeSingle` geeft simpelweg de
// eerste rij van de tabel. `tables.play_polls` bevat daarom per test precies de
// speeldag waar die test over gaat — en bij "niet gevonden" niets.
describe("<SpeeldagPagina />", () => {
  beforeEach(() => {
    stubPlaytomic();
    tables.profiles = PROFILES;
    tables.groups = GROUPS;
    tables.group_members = GROUP_MEMBERS;
    tables.matches = [];
    tables.play_polls = [openPoll];
    tables.play_poll_options = [openOption, bookedOption];
    tables.play_poll_votes = [
      vote("opt-open", "p1"),
      vote("opt-open", "p2"),
      vote("opt-booked", "p1"),
      vote("opt-booked", "p2"),
      vote("opt-booked", "p3"),
      vote("opt-booked", "p4"),
    ];
  });
  afterEach(() => vi.unstubAllGlobals());

  // De kern van #1121: één poll-id in de URL is genoeg. De groep staat er niet
  // bij en wordt uit de poll zelf afgeleid — anders zou elke deel-link en elk
  // pushbericht de groep moeten meedragen.
  it("leidt de groep uit de poll af en toont de speeldag", async () => {
    renderPagina("poll-open");

    expect(
      await screen.findByRole("heading", { name: /speeldag-poll/i }),
    ).toBeInTheDocument();
    // De groepsnaam is de context die op de groepspagina vanzelf sprak: hij
    // staat in de kop én is de weg terug naar die groep.
    expect(
      screen.getByRole("link", { name: GROUPS[0].name }),
    ).toHaveAttribute("href", "/groepen/g1");
  });

  // De reden dat deze pagina bestaat: de beheeracties zaten alleen op de
  // Plannen-tab en waren vanuit de agenda niet te bereiken.
  it("geeft de beheerder de acties van de Plannen-tab", async () => {
    renderPagina("poll-open");

    expect(
      await screen.findByRole("button", { name: /dagen aanpassen/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /herinner/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^↗ deel$/i })).toBeInTheDocument();
    // "Kies <dag> · <tijd>" legt het moment vast; zonder deze knop kwam je op
    // de agenda niet verder dan stemmen.
    expect(screen.getByRole("button", { name: /^kies /i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /annuleer poll/i }),
    ).toBeInTheDocument();
  });

  // Een geboekte speeldag komt binnen via WinnerCard: boekgegevens, poster en
  // het klaarzetten van de rondes.
  it("toont bij een geboekte speeldag de boekgegevens en het klaarzetten", async () => {
    tables.play_polls = [bookedPoll];
    renderPagina("poll-booked");

    expect(
      await screen.findByRole("heading", { name: /geboekte speeldag/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Baan 3 & 4")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /toegangscode 1234 kopiëren/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /genereer wedstrijden/i }),
    ).toBeInTheDocument();
  });

  // RLS maakt een poll uit een vreemde groep onvindbaar; dat is hetzelfde
  // antwoord als "bestaat niet" en hoort geen foutmelding-met-opnieuw te zijn.
  it("zegt het eerlijk als de speeldag niet te vinden is", async () => {
    tables.play_polls = [];
    renderPagina("poll-bestaat-niet");

    expect(
      await screen.findByText(/deze speeldag bestaat niet \(meer\)/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /naar de agenda/i })).toHaveAttribute(
      "href",
      "/agenda",
    );
    expect(
      screen.queryByRole("button", { name: /opnieuw proberen/i }),
    ).not.toBeInTheDocument();
  });
});
