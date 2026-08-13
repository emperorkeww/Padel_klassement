import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { PollWindow } from "@/features/groups/pollsApi";

// Een dag met een speeldag erop kon tot #1104 niets nieuws krijgen: kiesDag
// stuurde 'm naar het detail en daar hield het op. Deze test loopt de hele
// keten af — bezette dag → detail → plan-sheet — want dat is precies het stuk
// dat in Agenda.tsx zit en niet in DagSheet.

const CLUB = {
  id: "club-1",
  name: "Padel De Panne",
  city: "De Panne",
  timezone: "Europe/Brussels",
};

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "me" } }),
}));

vi.mock("@/features/availability/club", () => ({
  useClub: () => CLUB,
}));

// De clubkiezer haalt zelf clubs op; voor deze keten telt alleen dát er een
// club staat.
vi.mock("@/features/availability/components/ClubPicker", () => ({
  ClubPicker: () => <button type="button">Kies club</button>,
}));

vi.mock("@/features/groups/api", () => ({
  getMyGroups: () =>
    Promise.resolve([
      { id: "g1", name: "Vamos!", member_ids: ["me", "p2", "p3", "p4"] },
    ]),
}));

vi.mock("@/features/profiles/api", async (orig) => ({
  ...(await orig<typeof import("@/features/profiles/api")>()),
  getProfilesMap: () => Promise.resolve({}),
}));

const VENSTER: PollWindow = {
  polls: [
    {
      id: "poll-1",
      group_id: "g1",
      created_by: "p2",
      status: "booked",
      locked_option_id: "opt-1",
      created_at: "2026-08-01T10:00:00.000Z",
      locked_at: "2026-08-02T10:00:00.000Z",
      booked_at: "2026-08-02T11:00:00.000Z",
      club_id: CLUB.id,
      club_name: CLUB.name,
      club_city: CLUB.city,
      club_timezone: CLUB.timezone,
      access_code: null,
      courts: null,
      rounds_generated_at: null,
    },
  ],
  options: [
    {
      id: "opt-1",
      poll_id: "poll-1",
      group_id: "g1",
      date: "2026-08-13",
      start_time: "20:00",
      duration: 90,
      courts_free: null,
      created_at: "2026-08-01T10:00:00.000Z",
    },
  ],
  votes: [],
};

vi.mock("@/features/groups/pollsApi", async (orig) => ({
  ...(await orig<typeof import("@/features/groups/pollsApi")>()),
  getPollWindow: () => Promise.resolve(VENSTER),
}));

import { Agenda } from "./Agenda";

function toon(url = "/agenda") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <Agenda />
      </ToastProvider>
    </MemoryRouter>,
  );
}

/**
 * Een dag openen kost sinds #1270 één tik. Het waren er twee — eerst kiezen,
 * dan openen — maar het antwoord op die eerste tik stond op 390×800 buiten
 * beeld, dus de tweede betekenis viel niet te ontdekken.
 */
async function openDag(naam: RegExp) {
  const dag = await screen.findByRole("button", { name: naam });
  await userEvent.click(dag);
  return dag;
}

describe("<Agenda /> — plannen op een bezette dag (#1104)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("laat je vanaf een dag met een speeldag een tweede speeldag starten", async () => {
    toon();
    await openDag(/donderdag 13 augustus, speeldag geboekt/);
    expect(
      await screen.findByRole("dialog", { name: /donderdag 13 augustus/ }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Plan hier ook een speeldag" }),
    );
    // Het detail sluit en dezelfde keten als bij een lege dag neemt het over.
    expect(await screen.findByText("Plan een speeldag")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Kies momenten/ }),
    ).toBeInTheDocument();
  });

  it("biedt die uitweg niet op een dag die geweest is", async () => {
    // 20 september: 13 augustus ligt dan achter ons, met de speeldag erop.
    vi.setSystemTime(new Date("2026-09-20T09:00:00Z"));
    toon();
    await userEvent.click(
      await screen.findByRole("button", { name: /vorige maand/i }),
    );
    await openDag(/donderdag 13 augustus, speeldag gespeeld/);
    expect(
      await screen.findByRole("dialog", { name: /donderdag 13 augustus/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Plan hier ook een speeldag" }),
    ).not.toBeInTheDocument();
  });
});

describe("<Agenda /> — dag kiezen en openen (#1112)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("begint op vandaag", async () => {
    toon();
    expect(
      await screen.findByRole("heading", { name: /vandaag · vrijdag 7 augustus/i }),
    ).toBeInTheDocument();
  });

  it("opent een dag met één tik (#1270)", async () => {
    // Dit koste er twee. Het paneel dat op de eerste tik bijwerkte begon op
    // 390x800 bij y=744 met 730px in beeld, en aantikken scrollde niet: het
    // enige zichtbare gevolg was een gevulde cel.
    toon();
    await openDag(/donderdag 13 augustus, speeldag geboekt/);
    expect(
      await screen.findByRole("dialog", { name: /donderdag 13 augustus/ }),
    ).toBeInTheDocument();
  });

  it("stuurt één tik op een lege dag naar het plan-sheet", async () => {
    toon();
    // 20 augustus is leeg en ligt in de toekomst: daar valt te plannen.
    await openDag(/donderdag 20 augustus, niets gepland/);
    expect(await screen.findByText("Plan een speeldag")).toBeInTheDocument();
  });

  it("opent een lege dag die geweest is toch, met het eerlijke antwoord", async () => {
    // Niets doen zou de tik weer stil maken — precies de klacht waar #1270 mee
    // begon. Het sheet zegt daar wat er te zeggen valt.
    toon();
    await openDag(/zaterdag 1 augustus, niets gespeeld/);
    const sheet = await screen.findByRole("dialog", { name: /1 augustus/ });
    expect(sheet).toHaveTextContent("Deze dag is geweest");
  });

  it("opent vanaf 'Hierna' meteen die speeldag (#1270)", async () => {
    toon();
    // Vandaag (7 augustus) is leeg; 13 augustus is de eerstvolgende. De rij
    // koos die dag vroeger alleen, en wat dat opleverde stond buiten beeld.
    await userEvent.click(
      await screen.findByRole("button", { name: /do 13 aug, 20:00, Vamos!/ }),
    );
    expect(
      await screen.findByRole("dialog", { name: /donderdag 13 augustus/ }),
    ).toBeInTheDocument();
  });

  it("bladert met het toetsenbord door, ook al halen we verder op dan het raster", async () => {
    // Het ophaalvenster loopt zes weken voorbij het raster (#1112). Als de
    // toetsenbordnavigatie díe grens zou gebruiken in plaats van de
    // rastergrens, blijft de focus hangen op een dag die niet getekend is.
    toon();
    const raster = await screen.findByRole("grid");
    fireEvent.keyDown(raster, { key: "PageDown" });
    // findBy: het nieuwe maandvenster laadt, en dat is een async update.
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "September 2026",
    );
  });

  it("blijft bij het bladeren op vandaag geankerd (#1270)", async () => {
    // Het paneel ging over de dag die je aantikte en moest daarom meebladeren,
    // anders praatte het over een dag buiten het opgehaalde venster. Nu hangt
    // het aan vandaag: bladeren naar september laat het met rust, en je houdt
    // een anker op nu terwijl je vooruitkijkt.
    toon();
    await userEvent.click(
      screen.getByRole("button", { name: /volgende maand/i }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "September 2026" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /vandaag . vrijdag 7 augustus/i }),
    ).toBeInTheDocument();
  });

  it("legt alleen de statussen uit die in beeld staan", async () => {
    // In dit venster staat één geboekte speeldag. De legenda die daar "Open
    // poll" en "Vastgelegd" bij zet, legt vormen uit die nergens staan (#1182).
    toon();
    expect(await screen.findByText("Geboekt")).toBeInTheDocument();
    expect(screen.queryByText("Open poll")).not.toBeInTheDocument();
    expect(screen.queryByText("Vastgelegd")).not.toBeInTheDocument();
  });

  it("zegt dat je al op vandaag kijkt", async () => {
    toon();
    const vandaag = await screen.findByRole("button", { name: "Vandaag" });
    // Bij het openen sta je erop...
    expect(vandaag).toHaveAttribute("aria-current", "date");
    // ...en zodra je ergens anders kijkt, brengt de knop je weer ergens heen.
    await userEvent.click(
      screen.getByRole("button", { name: /donderdag 13 augustus/ }),
    );
    expect(vandaag).not.toHaveAttribute("aria-current");
  });

  it("plant met één knop, in beide weergaven (#1270)", async () => {
    // Plannen kon op vier manieren en geen enkele stond in beeld; in de lijst
    // kon het zelfs helemaal niet.
    toon("/agenda?weergave=lijst");
    await userEvent.click(
      await screen.findByRole("button", { name: "+ Speeldag" }),
    );
    expect(await screen.findByText("Plan een speeldag")).toBeInTheDocument();
  });

  it("laat de lijst zien wat eraan komt, en opent daar hetzelfde sheet", async () => {
    // De lijst is een tweede manier om te kijken, niet om te handelen (#1182):
    // dezelfde kaart, hetzelfde dag-sheet.
    toon();
    await userEvent.click(await screen.findByRole("tab", { name: "Lijst" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Wat komt eraan",
    );
    // Geen maandnavigatie meer: de lijst loopt gewoon door.
    expect(
      screen.queryByRole("button", { name: /volgende maand/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("do 13 aug · 20:00"));
    expect(
      await screen.findByRole("dialog", { name: /donderdag 13 augustus/ }),
    ).toBeInTheDocument();
  });

  it("opent de dag uit de link, inclusief het sheet", async () => {
    // Een gedeelde /agenda?dag=…&open=1 moet bij de ander dezelfde dag tonen —
    // niet zijn eigen vandaag (#1182).
    toon("/agenda?dag=2026-08-13&open=1");
    expect(
      await screen.findByRole("dialog", { name: /donderdag 13 augustus/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Augustus 2026",
    );
  });

  // #1213: de terugweg vanaf Banen. Daar staat per dag "Plan een speeldag";
  // die link landt hier en opent meteen dezelfde keten als een lege dag.
  it("opent het plan-sheet uit een ?plan=1-link", async () => {
    toon("/agenda?dag=2026-08-20&plan=1");
    expect(await screen.findByText("Plan een speeldag")).toBeInTheDocument();
    expect(
      screen.getByText(/donderdag 20 augustus/i, { selector: ".dagsheet__datum" }),
    ).toBeInTheDocument();
  });

  it("plant niet op een dag die geweest is", async () => {
    toon("/agenda?dag=2026-08-01&plan=1");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Plan een speeldag")).not.toBeInTheDocument();
  });

  it("laat het sheet weer los zonder de agenda te verlaten", async () => {
    // Openen duwt een history-entry, sluiten gaat er weer vanaf: op Android
    // sluit de terugknop daarmee het sheet in plaats van de pagina (#1182).
    //
    // Die stap brengt je terug op de entry van vóór het openen, en daar stond
    // de dag nog niet in — sinds #1270 is de tik die opent immers óók de eerste
    // tik. De markering keert dus terug naar vandaag, en dat klopt: je kijkt
    // dan naar niets meer in het bijzonder. Wat blijft staan is de maand.
    toon();
    await openDag(/donderdag 13 augustus, speeldag geboekt/);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Augustus 2026",
    );
  });

  it("houdt de dag vast als je hem uit een link opende", async () => {
    // Daar duwden we niets, dus sluiten wist alleen de sheet-vlag en blijf je
    // staan waar de link je bracht.
    toon("/agenda?dag=2026-08-13&open=1");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const dag = screen.getByRole("button", {
      name: /donderdag 13 augustus, speeldag geboekt/,
    });
    expect(dag.closest("[role=gridcell]")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("opent de lijst uit de link", async () => {
    toon("/agenda?weergave=lijst");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Wat komt eraan" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Lijst" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("laat een dag uit een andere maand zien zonder te herschrijven", async () => {
    // PageUp/PageDown kan de maand losmaken van de gekozen dag; die stand moet
    // een refresh overleven.
    toon("/agenda?dag=2026-08-13&maand=2026-09");
    expect(
      await screen.findByRole("heading", { level: 1, name: "September 2026" }),
    ).toBeInTheDocument();
  });

  it("bladert mee naar de maand van een aangetikte randdag", async () => {
    toon();
    // Het raster van augustus 2026 begint op maandag 27 juli.
    await userEvent.click(
      await screen.findByRole("button", { name: /maandag 27 juli/ }),
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Juli 2026");
    // En de dag zelf opent: het sheet zegt wat er die dag was.
    expect(
      await screen.findByRole("dialog", { name: /maandag 27 juli/i }),
    ).toBeInTheDocument();
  });
});
