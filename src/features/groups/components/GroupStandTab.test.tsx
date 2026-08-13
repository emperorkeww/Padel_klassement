import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// De roast/rivaliteit-kaarten onder de tabel (Rivalry/Pias/ZwartePiet) halen
// zelf contracten op en abonneren realtime; zonder mock zou de test een echte
// websocket openen. (Vendetta staat sinds #524 op de Teams-tab.)
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: makeSupabaseMock() };
});

import { GroupStandTab } from "./GroupStandTab";
import { ToastProvider } from "@/components/ui/ToastProvider";
import type { ZwartePietHolder } from "../zwartePietApi";
import type {
  Group,
  GroupMember,
  Match,
  PlayerRating,
  PlayerStanding,
  Profile,
  RatingPoint,
  Team,
} from "@/types";
import type { PredictionStanding } from "@/features/matches/predictions";
import { seasonFromId, type Season } from "@/features/rating/seasons";

const NOW = "2026-07-01T12:00:00Z";

// Vijf leden: drie op het podium, twee in de tabel eronder.
const IDS = ["p1", "p2", "p3", "p4", "p5"];
const profiles: Record<string, Profile> = Object.fromEntries(
  IDS.map((id, i) => [
    id,
    {
      id,
      username: `speler${i + 1}`,
      full_name: `Speler ${i + 1}`,
      avatar_url: null,
      created_at: NOW,
    } as Profile,
  ]),
);
const memberList: GroupMember[] = IDS.map((id) => ({
  group_id: "g1",
  player_id: id,
  role: "member",
  joined_at: NOW,
}));
const ratings: Record<string, PlayerRating> = Object.fromEntries(
  IDS.map((id, i) => [
    id,
    { player_id: id, rating: 1200 - i * 10, games: 5, updated_at: NOW },
  ]),
);
const histories: Record<string, RatingPoint[]> = Object.fromEntries(
  IDS.map((id) => [
    id,
    [
      {
        match_id: "m1",
        rating_before: 1190,
        rating_after: 1200,
        delta: 10,
        played_at: NOW,
      },
    ],
  ]),
);
const standings: PlayerStanding[] = IDS.map((id, i) => ({
  player_id: id,
  username: `speler${i + 1}`,
  full_name: `Speler ${i + 1}`,
  played: 5,
  won: 3,
  drawn: 1,
  lost: 1,
  points: 10 - i,
  goal_diff: 4,
}));
const predictions: PredictionStanding[] = IDS.map((id, i) => ({
  player_id: id,
  username: `speler${i + 1}`,
  full_name: `Speler ${i + 1}`,
  predicted: 5,
  correct: 4 - (i % 3),
  points: 8 - i,
}));
const group: Group = {
  id: "g1",
  name: "Testgroep",
  created_by: null,
  created_at: NOW,
};

function renderTab(
  overrides: {
    completedMatches?: Match[];
    teams?: Record<string, Team>;
    zwartePiet?: ZwartePietHolder | null;
    season?: Season | null;
    seasons?: Season[];
    seizoenRatings?: Record<string, number> | null;
  } = {},
) {
  return render(
    <MemoryRouter>
      <ToastProvider>
      <GroupStandTab
        matches={[]}
        completedMatches={overrides.completedMatches ?? []}
        teams={overrides.teams ?? {}}
        profiles={profiles}
        ratings={ratings}
        seizoenRatings={overrides.seizoenRatings ?? null}
        histories={histories}
        memberList={memberList}
        myId="p1"
        season={overrides.season ?? null}
        setSeasonId={() => {}}
        seasons={overrides.seasons ?? []}
        shownStandings={standings}
        champion={null}
        shownPredictionStandings={predictions}
        group={group}
        piasRatings={new Map()}
        zwartePiet={overrides.zwartePiet ?? null}
      />
      </ToastProvider>
    </MemoryRouter>,
  );
}

// #358: brede tabellen scrollen binnen hun eigen container zodat ze op een
// smalle telefoon niet de hele pagina laten overlopen (of stil afgeknipt
// worden door de overflow-clip van de shell).
describe("<GroupStandTab /> tabellen in .table-scroll (#358)", () => {
  const expectTablesWrapped = () => {
    const tables = document.querySelectorAll("table.table");
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(table.parentElement?.classList.contains("table-scroll")).toBe(
        true,
      );
    }
  };

  it("rating-tabel", () => {
    renderTab();
    expectTablesWrapped();
  });

  it("punten-tabel", () => {
    renderTab();
    fireEvent.click(screen.getByRole("tab", { name: "Punten" }));
    expectTablesWrapped();
  });

  it("toto-tabel", () => {
    renderTab();
    fireEvent.click(screen.getByRole("tab", { name: "Toto" }));
    expectTablesWrapped();
  });
});

// #523: 🃏 Zwarte Piet-drager en 🤡 Pias als emoji naast de naam in de stand.
describe("<GroupStandTab /> schande-tokens naast de naam (#523)", () => {
  const holder = (holderId: string): ZwartePietHolder => ({
    groupId: "g1",
    holderId,
    fromId: null,
    reden: "bagel",
    ernst: 6,
    detail: "kreeg een pandoering",
    matchId: "m1",
    since: "2026-07-01",
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("toont geen tekentje zonder Zwarte Piet of Pias", () => {
    renderTab();
    expect(screen.queryByTitle("Draagt de Zwarte Piet")).toBeNull();
    expect(screen.queryByTitle("Pias van de maand")).toBeNull();
  });

  it("zet 🃏 naast de naam van de Zwarte Piet-drager (p4, in de tabel)", () => {
    renderTab({ zwartePiet: holder("p4") });
    const mark = screen.getByTitle("Draagt de Zwarte Piet");
    expect(mark).toHaveTextContent("🃏");
    // Hoort bij Speler 4 — niet bij een willekeurige andere rij.
    expect(mark.closest(".cell-player")).toHaveTextContent("Speler 4");
  });

  it("zet 🤡 naast de naam van de Pias van de maand", () => {
    // monthRange() leunt op new Date(); prik de klok op juli 2026 en laat
    // team A (p4/p5) een bagel slikken → p4 is de pias (tie-break op laagste id).
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    const teams: Record<string, Team> = {
      tA: { id: "tA", name: null, player1_id: "p4", player2_id: "p5", created_at: "" },
      tB: { id: "tB", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
    };
    const bagel: Match = {
      id: "m1",
      team_a_id: "tA",
      team_b_id: "tB",
      status: "completed",
      winner_team_id: "tB",
      played_at: "2026-07-10T12:00:00Z",
      created_by: null,
      created_at: "2026-07-10T12:00:00Z",
      group_id: "g1",
      round_number: null,
      score_a: 0,
      score_b: 6,
      format: "2v2",
    };
    renderTab({ completedMatches: [bagel], teams });
    const mark = screen.getByTitle("Pias van de maand");
    expect(mark).toHaveTextContent("🤡");
    expect(mark.closest(".cell-player")).toHaveTextContent("Speler 4");
  });
});

// #607: de Zwarte Piet-kaart onderaan de stand rendert altijd — zonder drager
// als vrij-staat, zodat "kaart verdwenen" nooit meer als bug oogt.
describe("<GroupStandTab /> Zwarte Piet-kaart onderaan (#607)", () => {
  const holder = (holderId: string): ZwartePietHolder => ({
    groupId: "g1",
    holderId,
    fromId: null,
    reden: "bagel",
    ernst: 110,
    detail: "slikte een bagel 🥯",
    matchId: "m1",
    since: "2026-07-01",
  });

  it("toont de vrij-staat als niemand de Piet draagt", () => {
    renderTab();
    expect(screen.getByText("🃏 De Zwarte Piet")).toBeInTheDocument();
    expect(screen.getByText(/De Piet is vrij/)).toBeInTheDocument();
  });

  it("toont de drager in plaats van de vrij-staat", () => {
    renderTab({ zwartePiet: holder("p4") });
    expect(screen.getByText("🃏 De Zwarte Piet")).toBeInTheDocument();
    expect(screen.getByText("slikte een bagel 🥯")).toBeInTheDocument();
    expect(screen.queryByText(/De Piet is vrij/)).toBeNull();
  });
});

// #1298: de seizoenskiezer zat alleen in de punten- en toto-weergave, terwijl
// rating de standaard is. Wie de Stand opende, zag dus nooit dat er iets te
// bladeren viel — en de eregalerij eronder was daarmee onbereikbaar.
describe("<GroupStandTab /> seizoenskiezer en weergavekeuze (#1298)", () => {
  const q1 = seasonFromId("2026-q1")!;

  it("toont de seizoenskiezer in élke weergave", () => {
    renderTab({ seasons: [q1] });
    expect(screen.getByLabelText("Seizoen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Punten" }));
    expect(screen.getByLabelText("Seizoen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Rating" }));
    expect(screen.getByLabelText("Seizoen")).toBeInTheDocument();
  });

  it("presenteert de weergavekeuze als echte tabbalk", () => {
    renderTab({ seasons: [q1] });
    const balk = screen.getByRole("tablist", { name: /standweergave/i });
    expect(balk).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Rating" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Toto" }));
    expect(screen.getByRole("tab", { name: "Toto" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("toont bij een afgesloten seizoen de ratings van tóén", () => {
    renderTab({
      seasons: [q1],
      season: q1,
      // Omgekeerde volgorde t.o.v. `ratings`: p5 stond toen bovenaan.
      seizoenRatings: { p1: 1000, p2: 1010, p3: 1020, p4: 1030, p5: 1040 },
    });

    expect(screen.getByText(/eindstand van/i)).toHaveTextContent("Q1 2026");
    // Het podium toont de stand van toen, niet die van nu.
    expect(screen.getByText("1040")).toBeInTheDocument();
    expect(screen.queryByText("1200")).toBeNull();
    // Een ▲/▼ van vandaag zegt niets over een afgesloten kwartaal.
    expect(document.querySelector(".stat__delta")).toBeNull();
    expect(document.querySelector(".sparkline")).toBeNull();
  });

  it("houdt de live rating zolang er geen seizoen gekozen is", () => {
    renderTab({ seasons: [q1] });
    expect(screen.getByText("1200")).toBeInTheDocument();
    expect(screen.queryByText(/eindstand van/i)).toBeNull();
  });
});
