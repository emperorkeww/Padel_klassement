import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GroupStandTab } from "./GroupStandTab";
import type {
  Group,
  GroupMember,
  PlayerRating,
  PlayerStanding,
  Profile,
  RatingPoint,
} from "@/types";
import type { PredictionStanding } from "@/features/matches/predictions";

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

function renderTab() {
  return render(
    <MemoryRouter>
      <GroupStandTab
        matches={[]}
        completedMatches={[]}
        teams={{}}
        profiles={profiles}
        ratings={ratings}
        histories={histories}
        memberList={memberList}
        myId="p1"
        season={null}
        setSeasonId={() => {}}
        seasons={[]}
        shownStandings={standings}
        champion={null}
        shownPredictionStandings={predictions}
        group={group}
        piasRatings={new Map()}
        zwartePiet={null}
      />
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
    fireEvent.click(screen.getByRole("button", { name: "Punten" }));
    expectTablesWrapped();
  });

  it("toto-tabel", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Toto" }));
    expectTablesWrapped();
  });
});
