import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Match, PlayerRating, PlayerStanding, Profile, Team } from "@/types";

// Vier spelers; p1 & p2 zijn zowel partners (m1) als tegenstanders (m2, m3)
// geweest, zodat balans + historie beide takken raken. p5-p7 staan er voor de
// privacy-regel (#1014): alle drie verborgen, maar alleen p5 is een vreemde.
const PROFILES: Record<string, Profile> = {
  p1: { id: "p1", username: "alice", full_name: "Alice", avatar_url: null, created_at: "" },
  p2: { id: "p2", username: "bob", full_name: "Bob", avatar_url: null, created_at: "" },
  p3: { id: "p3", username: "carol", full_name: "Carol", avatar_url: null, created_at: "" },
  p4: { id: "p4", username: "dave", full_name: "Dave", avatar_url: null, created_at: "" },
  p5: { id: "p5", username: "eve", full_name: "Eve", avatar_url: null, created_at: "", discoverable: false },
  p6: { id: "p6", username: "frank", full_name: "Frank", avatar_url: null, created_at: "", discoverable: false },
  p7: { id: "p7", username: "grace", full_name: "Grace", avatar_url: null, created_at: "", discoverable: false },
};
const TEAMS: Record<string, Team> = {
  tAB: { id: "tAB", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tCD: { id: "tCD", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
  tAC: { id: "tAC", name: null, player1_id: "p1", player2_id: "p3", created_at: "" },
  tBD: { id: "tBD", name: null, player1_id: "p2", player2_id: "p4", created_at: "" },
};
const RATINGS: Record<string, PlayerRating> = {
  p1: { player_id: "p1", rating: 1300, games: 20, updated_at: "" },
  p2: { player_id: "p2", rating: 1200, games: 20, updated_at: "" },
  p3: { player_id: "p3", rating: 1100, games: 20, updated_at: "" },
};
const STANDINGS: PlayerStanding[] = [
  { player_id: "p1", username: "alice", full_name: "Alice", played: 3, won: 2, drawn: 0, lost: 1, points: 6, goal_diff: 4 },
  { player_id: "p2", username: "bob", full_name: "Bob", played: 3, won: 1, drawn: 0, lost: 2, points: 3, goal_diff: -2 },
];

const match = (part: Partial<Match>): Match => ({
  id: "m",
  team_a_id: "tAB",
  team_b_id: "tCD",
  status: "completed",
  winner_team_id: null,
  played_at: "2026-07-01T12:00:00Z",
  created_by: null,
  created_at: "2026-07-01T12:00:00Z",
  group_id: null,
  round_number: null,
  score_a: null,
  score_b: null,
  format: "2v2",
  ...part,
});

// p1's historie: samen winnen (m1), tegen elkaar 1-1 (m2 win, m3 verlies).
const P1_MATCHES: Match[] = [
  match({ id: "m1", team_a_id: "tAB", team_b_id: "tCD", winner_team_id: "tAB", played_at: "2026-07-03T12:00:00Z", set_scores: [[6, 4], [6, 3]] }),
  match({ id: "m2", team_a_id: "tAC", team_b_id: "tBD", winner_team_id: "tAC", played_at: "2026-07-02T12:00:00Z" }),
  match({ id: "m3", team_a_id: "tAC", team_b_id: "tBD", winner_team_id: "tBD", played_at: "2026-07-01T12:00:00Z" }),
];

const getPlayerMatches = vi.fn((id: string) =>
  Promise.resolve(id === "p1" ? P1_MATCHES : []),
);

vi.mock("@/features/standings/ratingsApi", () => ({
  getPlayerRatings: vi.fn(() => Promise.resolve(RATINGS)),
}));
vi.mock("@/features/standings/api", () => ({
  getPlayerStandings: vi.fn(() => Promise.resolve(STANDINGS)),
  getPlayerStanding: vi.fn((id: string) =>
    Promise.resolve(STANDINGS.find((s) => s.player_id === id) ?? null),
  ),
}));
vi.mock("@/features/profiles/api", async (orig) => ({
  ...(await orig<typeof import("@/features/profiles/api")>()),
  getProfilesMap: vi.fn(() => Promise.resolve(PROFILES)),
}));
vi.mock("@/features/matches/api", async (orig) => ({
  ...(await orig<typeof import("@/features/matches/api")>()),
  getTeamsMap: vi.fn(() => Promise.resolve(TEAMS)),
  getPlayerMatches: (...args: [string, number?]) => getPlayerMatches(args[0]),
}));
// p1 (de ingelogde speler) is bevriend met p6 en zit met p7 in een groep; p5
// kent hij niet. Zo raakt de privacy-regel al haar takken.
vi.mock("@/features/friends/api", async (orig) => ({
  ...(await orig<typeof import("@/features/friends/api")>()),
  getMyFriendships: vi.fn(() =>
    Promise.resolve([
      {
        id: "f1",
        requester_id: "p1",
        addressee_id: "p6",
        status: "accepted",
        created_at: "",
        updated_at: "",
      },
    ]),
  ),
}));
vi.mock("@/features/groups/api", async (orig) => ({
  ...(await orig<typeof import("@/features/groups/api")>()),
  getMyGroups: vi.fn(() =>
    Promise.resolve([{ id: "g1", name: "Groep", member_ids: ["p1", "p7"] }]),
  ),
}));
vi.mock("@/features/auth/api", () => ({
  getSession: () => Promise.resolve({ data: { session: { user: { id: "p1" } } } }),
  onAuthStateChange: () => ({
    data: { subscription: { unsubscribe: () => {} } },
  }),
  signOut: () => Promise.resolve(),
}));

import { AuthProvider } from "@/features/auth/AuthProvider";
import { ComparisonSheet } from "./ComparisonSheet";

function renderSheet(leftId = "p1", rightId = "p2") {
  return render(
    <AuthProvider>
      <ComparisonSheet
        open
        onClose={() => {}}
        defaultLeftId={leftId}
        defaultRightId={rightId}
      />
    </AuthProvider>,
  );
}

beforeEach(() => {
  getPlayerMatches.mockClear();
});

describe("ComparisonSheet", () => {
  it("toont beide spelers, laat de hogere Elo oplichten en de onderlinge balans zien", async () => {
    renderSheet();

    // Namen boven de vergelijking (de dropdown-opties heten ook zo, dus
    // scopen we op de kop-spans).
    await screen.findByText("Alice", { selector: ".vs-names__name" });
    expect(
      screen.getByText("Bob", { selector: ".vs-names__name" }),
    ).toBeInTheDocument();

    // Elo-rij: 1300 (Alice) wint van 1200 (Bob).
    const eloVal = await screen.findByText("1300");
    expect(screen.getByText("1200")).toBeInTheDocument();
    // De winnende kant krijgt de is-winner-modifier.
    expect(eloVal.closest(".vs-rij__side")?.className).toContain("is-winner");

    // Onderlinge balans: als tegenstanders 1-1, als partners 1 match 100%.
    expect(screen.getByText("Als tegenstanders")).toBeInTheDocument();
    expect(screen.getByText("Als partners")).toBeInTheDocument();
    expect(screen.getByText(/100% gewonnen/)).toBeInTheDocument();

    // Gezamenlijke historie: 3 matches, met duo- en rivalen-labels.
    expect(screen.getByText("🤝 Samen")).toBeInTheDocument();
    expect(screen.getAllByText("⚔️ Tegen")).toHaveLength(2);
    // Setstanden van m1.
    expect(screen.getByText("6-4 6-3")).toBeInTheDocument();
  });

  it("herlaadt de matches wanneer een speler gewisseld wordt", async () => {
    renderSheet();
    await screen.findByText("Alice", { selector: ".vs-names__name" });
    getPlayerMatches.mockClear();

    fireEvent.change(screen.getByLabelText("Speler rechts"), {
      target: { value: "p3" },
    });

    // De rechterkant haalt nu p3's matches op; p1 wordt niet opnieuw geladen.
    await vi.waitFor(() =>
      expect(getPlayerMatches).toHaveBeenCalledWith("p3"),
    );
    expect(getPlayerMatches).not.toHaveBeenCalledWith("p1");
  });

  it("vraagt om twee verschillende spelers bij een gelijke keuze", async () => {
    renderSheet("p1", "p1");
    expect(
      await screen.findByText(/Kies twee verschillende spelers/),
    ).toBeInTheDocument();
  });

  // #1014: de keuzelijst is precies zo'n plek waar je iemand "aangeboden"
  // krijgt, dus de privacy-toggle hoort er te gelden — met de uitzondering dat
  // wie je al kent gewoon kiesbaar blijft.
  describe("privacy (#1014)", () => {
    async function opties(label: "Speler links" | "Speler rechts") {
      await screen.findByText("Alice", { selector: ".vs-names__name" });
      const select = await screen.findByLabelText(label);
      return within(select as HTMLElement)
        .getAllByRole("option")
        .map((o) => o.textContent);
    }

    it("laat een verborgen vreemde weg uit beide keuzelijsten", async () => {
      renderSheet();
      expect(await opties("Speler links")).not.toContain("Eve");
      expect(await opties("Speler rechts")).not.toContain("Eve");
    });

    it("houdt een verborgen vriend en groepsgenoot wél kiesbaar", async () => {
      renderSheet();
      const namen = await opties("Speler rechts");
      expect(namen).toContain("Frank");
      expect(namen).toContain("Grace");
    });

    it("houdt een verborgen speler kiesbaar als de sheet met hem geopend is", async () => {
      renderSheet("p1", "p5");
      // p5 is een vreemde en zou normaal wegvallen, maar je hebt zijn profiel
      // al voor je — hem uit zijn eigen vergelijking filteren helpt niemand.
      expect(await opties("Speler rechts")).toContain("Eve");
    });
  });
});
