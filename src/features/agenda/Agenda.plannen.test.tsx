import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { PollWindow } from "@/features/groups/pollsApi";

// Een dag met een speeldag erop kon tot #1104 niets nieuws krijgen: kiesDag
// stuurde 'm naar het detail en daar hield het op. Deze test loopt de hele
// keten af — bezette dag → detail → wizard — want dat is precies het stuk dat
// in Agenda.tsx zit en niet in DagSheet.
//
// Sinds #1308 is die keten één sheet korter: het plan-sheet dat alleen om een
// groep vroeg is opgegaan in de kop van de wizard.

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

// Sinds #1308 rendert de wizard rechtstreeks in deze keten (er zit geen
// plan-sheet meer tussen), en die leest méér uit deze module dan alleen de
// clubkeuze — vandaar de rest van de echte module erbij.
vi.mock("@/features/availability/club", async (orig) => ({
  ...(await orig<typeof import("@/features/availability/club")>()),
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

/** De querystring van de router zichtbaar maken: MemoryRouter raakt
 *  `window.location` niet, en de agenda schrijft juist daar zijn stand. */
function UrlSonde() {
  const { search } = useLocation();
  return <output data-testid="url">{search}</output>;
}

function toon(url = "/agenda") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <Agenda />
        <UrlSonde />
      </ToastProvider>
    </MemoryRouter>,
  );
}

/** De terugknop van de telefoon: in MemoryRouter is dat een stap terug in de
 *  router-geschiedenis, niet in `window.history`. */
function terug() {
  fireEvent.keyDown(window, { key: "Escape" });
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
    // Het detail sluit en dezelfde wizard als bij een lege dag neemt het over.
    expect(
      await screen.findByRole("dialog", { name: "Speeldag plannen" }),
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

  it("stuurt één tik op een lege dag meteen naar de wizard", async () => {
    toon();
    // 20 augustus is leeg en ligt in de toekomst: daar valt te plannen. Sinds
    // #1308 zonder tussenscherm — dat vroeg alleen om een groep.
    await openDag(/donderdag 20 augustus, niets gepland/);
    expect(
      await screen.findByRole("dialog", { name: "Speeldag plannen" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/donderdag 20 augustus/i)).toBeInTheDocument();
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
    expect(screen.queryByText("Stemmen open")).not.toBeInTheDocument();
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
    expect(
      await screen.findByRole("dialog", { name: "Speeldag plannen" }),
    ).toBeInTheDocument();
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
  it("opent de wizard uit een ?plan=1-link", async () => {
    toon("/agenda?dag=2026-08-20&plan=1");
    expect(
      await screen.findByRole("dialog", { name: "Speeldag plannen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/donderdag 20 augustus/i, {
        selector: ".wizard-sheet__dag",
      }),
    ).toBeInTheDocument();
  });

  it("plant niet op een dag die geweest is", async () => {
    toon("/agenda?dag=2026-08-01&plan=1");
    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.queryByRole("dialog", { name: "Speeldag plannen" }),
    ).not.toBeInTheDocument();
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

/* ---- #1308: één doorloop, en de terugknop sluit wat bovenop ligt ---- */

describe("<Agenda /> — de plan-doorloop (#1308)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("zet de wizard in de URL, zodat je hem kunt delen en terugvinden", async () => {
    // Was een instapvlag die de agenda meteen wiste: de wizard leefde daarna
    // alleen in component-state, en dus buiten de geschiedenis.
    toon();
    await openDag(/donderdag 20 augustus, niets gepland/);
    await screen.findByRole("dialog", { name: "Speeldag plannen" });
    const url = screen.getByTestId("url").textContent ?? "";
    expect(url).toContain("plan=1");
    expect(url).toContain("dag=2026-08-20");
  });

  it("sluit met de terugknop de wizard en niet de agenda", async () => {
    // Het dag-sheet duwde een history-entry en de wizard niet: één tik op terug
    // haalde de pagina onder een openstaande wizard vandaan zonder hem te
    // sluiten.
    toon();
    await openDag(/donderdag 20 augustus, niets gepland/);
    await screen.findByRole("dialog", { name: "Speeldag plannen" });

    terug();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Speeldag plannen" }),
      ).not.toBeInTheDocument(),
    );
    // De agenda staat er nog, en de vlag is uit de URL.
    expect(screen.getByTestId("url").textContent).not.toContain("plan=1");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Augustus 2026",
    );
  });

  it("brengt de terugknop je van de wizard terug in het dag-sheet", async () => {
    // "Plan hier ook een speeldag" vervangt het dag-sheet in beeld, maar laat
    // de entry eronder staan — dus terug brengt je waar je vandaan kwam.
    toon();
    await openDag(/donderdag 13 augustus, speeldag geboekt/);
    await userEvent.click(
      await screen.findByRole("button", { name: "Plan hier ook een speeldag" }),
    );
    await screen.findByRole("dialog", { name: "Speeldag plannen" });

    terug();
    expect(
      await screen.findByRole("dialog", { name: /donderdag 13 augustus/ }),
    ).toBeInTheDocument();
  });

  it("noemt de groep en de dag waarvoor je plant", async () => {
    // De wizard wist niet meer voor wie hij plande: met twee groepen die
    // allebei op donderdag spelen was dat de enige keuze die je nog fout kon
    // hebben, en ze stond nergens. Bij één groep is het een regel en geen
    // keuze — er valt niets te kiezen.
    toon();
    await openDag(/donderdag 20 augustus, niets gepland/);
    const sheet = await screen.findByRole("dialog", { name: "Speeldag plannen" });
    expect(sheet).toHaveTextContent("Vamos!");
    expect(sheet).toHaveTextContent("4 leden");
    expect(sheet).toHaveTextContent("donderdag 20 augustus");
  });
});
