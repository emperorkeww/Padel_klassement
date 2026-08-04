import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// Alice (p1) speelt mee in t-ab, heeft haar rating ingelopen en de match begint
// pas over twee dagen: precies het venster waarin inzetten mag.
const OVER_2_DAGEN = new Date(Date.now() + 2 * 86400_000).toISOString();

// De mock leest deze map bij elke from(); door hem per test in plaats te
// muteren wisselt de testdata mee zonder de client opnieuw op te bouwen.
const { tables } = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { supabase } from "@/lib/supabase/client";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { playDay } from "@/features/matches/stakes";
import { MATCH_PLANNED, PROFILES, TABLES, TEAMS } from "@/test/fixtures";
import type { Match, Profile, Team } from "@/types";
import { openPlannedCards } from "@/test/plannedCard";

// Los 1v1-team van Bob, zodat er een match bestaat waarin Alice niet meespeelt.
const T_B = {
  id: "t-b",
  name: null,
  player1_id: "p2",
  player2_id: null,
  created_at: OVER_2_DAGEN,
};

const tmap = Object.fromEntries(
  [...TEAMS, T_B].map((t) => [t.id, t]),
) as Record<string, Team>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

const INGELOPEN = [
  { player_id: "p1", rating: 1012, games: 12, updated_at: OVER_2_DAGEN },
  { player_id: "p2", rating: 1012, games: 12, updated_at: OVER_2_DAGEN },
  { player_id: "p3", rating: 988, games: 12, updated_at: OVER_2_DAGEN },
  { player_id: "p4", rating: 988, games: 12, updated_at: OVER_2_DAGEN },
];

const GEPLAND = { ...MATCH_PLANNED, played_at: OVER_2_DAGEN } as Match;

function stakeRij(matchId: string, playerId: string) {
  return {
    match_id: matchId,
    player_id: playerId,
    group_id: "g1",
    play_date: "2026-01-01",
    created_at: OVER_2_DAGEN,
  };
}

// Tweede ronde op dezelfde speeldag: samen dragen ze één lef-tegoed (#907).
const GEPLAND_B = { ...GEPLAND, id: "m-plan-2", round_number: 3 } as Match;

/** Speeldag in clubtijd — de sleutel waarop het tegoed geteld wordt. */
const DAG = playDay(OVER_2_DAGEN);

function setTables(over: Record<string, unknown[]> = {}) {
  for (const key of Object.keys(tables)) delete tables[key];
  Object.assign(tables, {
    ...TABLES,
    matches: [GEPLAND],
    player_ratings: INGELOPEN,
    match_stakes: [],
    ...over,
  });
}

function renderCard(match: Match = GEPLAND) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <PlannedMatchCard match={match} teams={tmap} profiles={pmap} />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setTables();
  vi.clearAllMocks();
  // Verse querycache: de inzetten van de vorige test mogen niet blijven hangen.
  invalidateAll();
});

describe("<PlannedMatchCard /> lef-tip", () => {
  it("toont wat er op het spel staat en zet de inzet weg", async () => {
    renderCard();
    await openPlannedCards();
    // Open tegel binnen de uitgeklapte kaart: de uitleg staat er direct.
    expect(
      await screen.findByText(/verlies je, dan telt je verlies net zo hard/i),
    ).toBeInTheDocument();
    // Beide kanten worden getoond: verdubbeld én de normale mutatie.
    expect(screen.getByText(/zonder inzet/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /zet je lef in/i }));
    expect(supabase.from).toHaveBeenCalledWith("match_stakes");
  });

  it("trekt een bestaande inzet weer in", async () => {
    setTables({ match_stakes: [stakeRij(GEPLAND.id, "p1")] });
    renderCard();
    await openPlannedCards();
    // De kopregel van de tegel verraadt de eigen inzet meteen.
    expect(await screen.findByText(/jouw lef staat ingezet/i)).toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole("button", { name: /inzet intrekken/i }),
    );
    expect(supabase.from).toHaveBeenCalledWith("match_stakes");
  });

  it("houdt een speler met een nog niet ingelopen rating tegen", async () => {
    setTables({
      player_ratings: INGELOPEN.map((r) =>
        r.player_id === "p1" ? { ...r, games: 4 } : r,
      ),
    });
    renderCard();
    await openPlannedCards();
    // Specifiek op de lef-zin: sinds de jokers (#1003) staat dezelfde drempel
    // ook op de jokertegel eronder, met een eigen vervolg ("deze kaart kan …").
    expect(
      await screen.findByText(/nog 6 matches te gaan: inzetten kan/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zet je lef in/i })).toBeDisabled();
  });

  it("onthult pas na de aftrap wie er lef had", async () => {
    const begonnen = {
      ...GEPLAND,
      played_at: new Date(Date.now() - 3600_000).toISOString(),
    } as Match;
    setTables({
      matches: [begonnen],
      match_stakes: [stakeRij(begonnen.id, "p2")],
    });
    renderCard(begonnen);
    await openPlannedCards();
    expect(
      await screen.findByText(/lef getoond door bob/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zet je lef in/i })).toBeDisabled();
  });

  // ── De kop-pil op de dichte kaart (#981) ──────────────────────────────────

  it("toont op de dichte kaart dat jouw lef hier staat", async () => {
    setTables({ match_stakes: [stakeRij(GEPLAND.id, "p1")] });
    renderCard();
    // Zonder de kaart te openen: de pil staat op de kop.
    expect(await screen.findByText(/jouw lef/i)).toBeInTheDocument();
  });

  it("verklapt andermans inzet niet op de dichte kaart vóór de aftrap", async () => {
    setTables({ match_stakes: [stakeRij(GEPLAND.id, "p2")] });
    renderCard();
    // Wachten tot de kaart (en dus de stakes-fetch) er staat.
    await screen.findByRole("button", { name: /uitslag invullen/i });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/jouw lef/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lef:/i)).not.toBeInTheDocument();
  });

  it("onthult op de dichte kaart wie er lef had zodra de match begonnen is", async () => {
    const begonnen = {
      ...GEPLAND,
      played_at: new Date(Date.now() - 3600_000).toISOString(),
    } as Match;
    setTables({
      matches: [begonnen],
      match_stakes: [
        stakeRij(begonnen.id, "p2"),
        stakeRij(begonnen.id, "p4"),
      ],
    });
    renderCard(begonnen);
    // Zonder openen; bij meerdere inzetters kort de pil in tot "Bob Boers +1".
    expect(await screen.findByText(/lef: bob boers \+1/i)).toBeInTheDocument();
  });

  it("toont geen lef-blok bij een match waarin je niet meespeelt", async () => {
    const anderen = {
      ...GEPLAND,
      team_a_id: "t-b",
      team_b_id: "t-c",
      format: "1v1",
    } as Match;
    setTables({ matches: [anderen] });
    renderCard(anderen);
    await openPlannedCards();
    // De toto-tegel hoort er wel te staan (het blijft een groepsmatch).
    await screen.findByText(/🎯 toto/i);
    expect(screen.queryByText(/🎲 lef/i)).not.toBeInTheDocument();
  });
});

// ── Het dagtegoed over twee kaarten (#907) ──────────────────────────────────
// De basis-mock filtert niet en schrijft niet: elke select geeft de hele tabel
// terug en een insert/delete verdwijnt. Voor het tegoed is dat te grof — wie op
// wélke match inzet is nu juist de vraag. Deze query-bouwer houdt de eq-filters
// bij en laat schrijfacties echt op `tables.match_stakes` landen, zodat een
// volgende select ziet wat de kaart zojuist deed.
type Rij = Record<string, unknown>;

function stakesQuery() {
  const filters: [string, unknown][] = [];
  let invoer: Rij | null = null;
  let wissen = false;
  const q: Record<string, unknown> = {};
  for (const m of ["select", "order", "in", "is", "limit", "match"])
    q[m] = () => q;
  q.eq = (kolom: string, waarde: unknown) => {
    filters.push([kolom, waarde]);
    return q;
  };
  q.insert = (rij: Rij) => {
    invoer = rij;
    return q;
  };
  q.delete = () => {
    wissen = true;
    return q;
  };
  const past = (r: Rij) => filters.every(([k, v]) => r[k] === v);
  const rijen = () => (tables.match_stakes ?? []) as Rij[];
  q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
    if (invoer) {
      // play_date zet de guard serverside af uit de starttijd; de client stuurt
      // die kolom niet mee.
      rijen().push({ ...invoer, play_date: DAG, created_at: OVER_2_DAGEN });
    } else if (wissen) {
      tables.match_stakes = rijen().filter((r) => !past(r));
    }
    const data = invoer || wissen ? [] : rijen().filter(past);
    return Promise.resolve({ data, error: null }).then(resolve, reject);
  };
  return q;
}

type FromMock = {
  getMockImplementation: () => (table: string) => unknown;
  mockImplementation: (impl: (table: string) => unknown) => void;
};

const fromMock = supabase.from as unknown as FromMock;
const basisFrom = fromMock.getMockImplementation();

function renderTwee() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <PlannedMatchCard match={GEPLAND} teams={tmap} profiles={pmap} />
          <PlannedMatchCard match={GEPLAND_B} teams={tmap} profiles={pmap} />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** De twee lef-tegels, in renderoorde: [ronde 2, ronde 3]. */
async function tegels() {
  const gevonden = await screen.findAllByRole("region", { name: "Lef" });
  expect(gevonden).toHaveLength(2);
  return gevonden;
}

const knop = (tegel: HTMLElement) => within(tegel).getByRole("button");

describe("lef-dagtegoed over twee matchkaarten (#907)", () => {
  beforeEach(() => {
    setTables({ matches: [GEPLAND, GEPLAND_B] });
    fromMock.mockImplementation((table: string) =>
      table === "match_stakes" ? stakesQuery() : basisFrom(table),
    );
  });

  afterEach(() => {
    fromMock.mockImplementation(basisFrom);
  });

  it("blokkeert de andere kaart zodra je ergens inzet, en geeft hem weer vrij zodra je intrekt", async () => {
    renderTwee();
    await openPlannedCards();
    const [a, b] = await tegels();
    await waitFor(() => expect(knop(b)).toBeEnabled());

    // Inzetten op ronde 2: het tegoed van de dag is daarmee vergeven.
    await userEvent.click(knop(a));
    await waitFor(() => expect(knop(a)).toHaveTextContent(/inzet intrekken/i));
    await waitFor(() => expect(knop(b)).toBeDisabled());
    expect(
      within(b).getByText(/je lef is vandaag al vergeven/i),
    ).toBeInTheDocument();

    // Weer intrekken: ronde 3 hoort meteen open te staan, zonder refresh.
    await userEvent.click(knop(a));
    await waitFor(() => expect(knop(b)).toBeEnabled());
    expect(knop(b)).toHaveTextContent(/zet je lef in/i);
    expect(
      within(b).queryByText(/je lef is vandaag al vergeven/i),
    ).not.toBeInTheDocument();
  });

  it("wijst aan waar je lef al staat en springt naar die kaart (#981)", async () => {
    setTables({
      matches: [GEPLAND, GEPLAND_B],
      // play_date moet de echte speeldag zijn, anders telt het tegoed niet.
      match_stakes: [{ ...stakeRij(GEPLAND.id, "p1"), play_date: DAG }],
    });
    // jsdom kent scrollIntoView niet; de spy bewijst de sprong.
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <PlannedMatchCard
              match={GEPLAND}
              teams={tmap}
              profiles={pmap}
              history={[GEPLAND, GEPLAND_B]}
            />
            <PlannedMatchCard
              match={GEPLAND_B}
              teams={tmap}
              profiles={pmap}
              history={[GEPLAND, GEPLAND_B]}
            />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    await openPlannedCards();
    const [, b] = await tegels();
    // Niet alleen "al vergeven": de voet noemt de match waar je lef wél staat.
    expect(
      await within(b).findByText(/je lef staat vandaag al op/i),
    ).toBeInTheDocument();
    await userEvent.click(within(b).getByRole("button", { name: /ronde 2/i }));
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("laat de kaart waarop je inzet zelf ook meteen kloppen", async () => {
    renderTwee();
    await openPlannedCards();
    const [a] = await tegels();

    await userEvent.click(knop(a));
    expect(
      await within(a).findByText(/jouw lef staat ingezet/i),
    ).toBeInTheDocument();

    await userEvent.click(knop(a));
    await waitFor(() => expect(knop(a)).toHaveTextContent(/zet je lef in/i));
    expect(within(a).getByText(/dubbel of niets\?/i)).toBeInTheDocument();
  });
});
