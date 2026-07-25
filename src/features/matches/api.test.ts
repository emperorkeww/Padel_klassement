import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const h = await import("@/test/apiHarness");
  return { supabase: h.build() };
});

import { enqueue, reset, calls } from "@/test/apiHarness";
import {
  toSetScores,
  readSetScores,
  formatSetScores,
  emptySet,
  createCompletedMatch,
  createPlannedMatch,
  setMatchResult,
  updateMatchScore,
  createGuestPlayer,
  deleteMatch,
  replaceMatchPlayer,
} from "./api";
import type { Match } from "@/types";

beforeEach(() => reset());

// --- Pure helpers (geen supabase-mock nodig) ---------------------------------

describe("toSetScores", () => {
  it("zet volledige rijen om naar [a, b]-paren", () => {
    expect(
      toSetScores([
        { a: "6", b: "4" },
        { a: "3", b: "6" },
        { a: "7", b: "5" },
      ]),
    ).toEqual([
      [6, 4],
      [3, 6],
      [7, 5],
    ]);
  });

  it("filtert half-lege rijen weg", () => {
    expect(
      toSetScores([
        { a: "6", b: "4" },
        { a: "6", b: "" },
        { a: "", b: "3" },
        emptySet(),
      ]),
    ).toEqual([[6, 4]]);
  });

  it("filtert ongeldige of negatieve getallen weg", () => {
    expect(
      toSetScores([
        { a: "abc", b: "4" },
        { a: "6", b: "-1" },
        { a: "5", b: "3" },
      ]),
    ).toEqual([[5, 3]]);
  });
});

describe("readSetScores", () => {
  it("leest geldige paren uit de jsonb-kolom", () => {
    const match = { set_scores: [[6, 4], [3, 6]] } as unknown as Match;
    expect(readSetScores(match)).toEqual([[6, 4], [3, 6]]);
  });

  it("negeert ongeldige rijen en geeft null bij niets bruikbaars", () => {
    const partial = {
      set_scores: [[6, 4], [6], ["x", 3], [1, 2, 3]],
    } as unknown as Match;
    expect(readSetScores(partial)).toEqual([[6, 4]]);

    expect(readSetScores({ set_scores: null } as unknown as Match)).toBeNull();
    expect(readSetScores({ set_scores: "nope" } as unknown as Match)).toBeNull();
    expect(readSetScores({ set_scores: [["a", "b"]] } as unknown as Match)).toBeNull();
  });
});

describe("formatSetScores", () => {
  it("bouwt de weergavestring", () => {
    expect(formatSetScores([[6, 4], [3, 6], [7, 5]])).toBe("6-4 3-6 7-5");
  });

  it("geeft een lege string bij lege of ontbrekende input", () => {
    expect(formatSetScores(null)).toBe("");
    expect(formatSetScores(undefined)).toBe("");
    expect(formatSetScores([])).toBe("");
  });
});

// --- createCompletedMatch ----------------------------------------------------

describe("createCompletedMatch", () => {
  it("roept de rpc met de juiste param-mapping (2v2)", async () => {
    enqueue({ data: "match-1" });
    const id = await createCompletedMatch({
      a1: "a1",
      a2: "a2",
      b1: "b1",
      b2: "b2",
      winner: "a",
      scoreA: 6,
      scoreB: 3,
      groupId: "g1",
      setScores: [[6, 3]],
      courtType: "binnen",
      clientToken: "tok-1",
    });
    expect(id).toBe("match-1");
    expect(calls).toContainEqual({
      method: "rpc",
      name: "create_completed_match",
      args: [
        expect.objectContaining({
          p_a1: "a1",
          p_a2: "a2",
          p_b1: "b1",
          p_b2: "b2",
          p_winner: "a",
          p_score_a: 6,
          p_score_b: 3,
          p_group_id: "g1",
          p_set_scores: [[6, 3]],
          p_court_type: "binnen",
          p_client_token: "tok-1",
        }),
      ],
    });
  });

  it("mapt 1v1 (a2/b2 null) naar p_a2/p_b2 null", async () => {
    enqueue({ data: "match-2" });
    await createCompletedMatch({
      a1: "a1",
      a2: null,
      b1: "b1",
      b2: null,
      winner: "draw",
    });
    const rpc = calls.find((c) => c.method === "rpc");
    const params = rpc?.args[0] as Record<string, unknown>;
    expect(params.p_a2).toBeNull();
    expect(params.p_b2).toBeNull();
    expect(params.p_winner).toBe("draw");
  });

  it("gooit door bij een rpc-fout", async () => {
    enqueue({ error: new Error("rpc stuk") });
    await expect(
      createCompletedMatch({ a1: "a1", a2: null, b1: "b1", b2: null, winner: "a" }),
    ).rejects.toThrow("rpc stuk");
  });
});

// --- createPlannedMatch ------------------------------------------------------

describe("createPlannedMatch", () => {
  it("roept create_planned_match met p_played_at", async () => {
    enqueue({ data: "planned-1" });
    const id = await createPlannedMatch({
      a1: "a1",
      a2: "a2",
      b1: "b1",
      b2: "b2",
      playedAt: "2026-07-22T10:00:00Z",
      groupId: "g1",
    });
    expect(id).toBe("planned-1");
    expect(calls).toContainEqual({
      method: "rpc",
      name: "create_planned_match",
      args: [
        expect.objectContaining({
          p_a1: "a1",
          p_played_at: "2026-07-22T10:00:00Z",
          p_group_id: "g1",
        }),
      ],
    });
  });

  it("gooit door bij een fout", async () => {
    enqueue({ error: new Error("plan stuk") });
    await expect(
      createPlannedMatch({ a1: "a1", a2: null, b1: "b1", b2: null }),
    ).rejects.toThrow("plan stuk");
  });
});

// --- setMatchResult ----------------------------------------------------------

describe("setMatchResult", () => {
  it("slaagt wanneer de update één rij teruggeeft", async () => {
    enqueue({ data: [{ id: "m1" }] });
    await expect(
      setMatchResult({ matchId: "m1", winnerTeamId: "t-a", scoreA: 6, scoreB: 3 }),
    ).resolves.toBeUndefined();
    const upd = calls.find((c) => c.method === "update");
    expect(upd?.args[0]).toMatchObject({
      status: "completed",
      winner_team_id: "t-a",
      score_a: 6,
      score_b: 3,
    });
  });

  it("meldt dat de match niet meer bestaat (0 rijen + geen lookup)", async () => {
    enqueue({ data: [] }, { data: null });
    await expect(
      setMatchResult({ matchId: "m1", winnerTeamId: null }),
    ).rejects.toThrow("Deze match bestaat niet meer.");
  });

  it("meldt dat de uitslag al is ingevuld (0 rijen + status completed)", async () => {
    enqueue({ data: [] }, { data: { status: "completed" } });
    await expect(
      setMatchResult({ matchId: "m1", winnerTeamId: null }),
    ).rejects.toThrow("Deze uitslag is al door iemand anders ingevuld.");
  });

  it("meldt een rechten-probleem (0 rijen + status scheduled)", async () => {
    enqueue({ data: [] }, { data: { status: "scheduled" } });
    await expect(
      setMatchResult({ matchId: "m1", winnerTeamId: null }),
    ).rejects.toThrow(/alleen de spelers/i);
  });

  it("gooit direct door bij een update-fout", async () => {
    enqueue({ error: new Error("update stuk") });
    await expect(
      setMatchResult({ matchId: "m1", winnerTeamId: null }),
    ).rejects.toThrow("update stuk");
  });
});

// --- updateMatchScore --------------------------------------------------------

describe("updateMatchScore", () => {
  it("update de score op de matches-tabel", async () => {
    enqueue({ error: null });
    await updateMatchScore({
      matchId: "m1",
      winnerTeamId: "t-b",
      scoreA: 4,
      scoreB: 6,
    });
    const upd = calls.find((c) => c.method === "update");
    expect(upd?.table).toBe("matches");
    expect(upd?.args[0]).toMatchObject({
      winner_team_id: "t-b",
      score_a: 4,
      score_b: 6,
    });
    // set_scores niet meegegeven → niet in de patch (bestaande stand behouden).
    expect(upd?.args[0]).not.toHaveProperty("set_scores");
    const eq = calls.find((c) => c.method === "eq");
    expect(eq?.args).toEqual(["id", "m1"]);
  });

  it("gooit door bij een fout", async () => {
    enqueue({ error: new Error("score stuk") });
    await expect(
      updateMatchScore({ matchId: "m1", winnerTeamId: null, scoreA: 1, scoreB: 2 }),
    ).rejects.toThrow("score stuk");
  });
});

// --- createGuestPlayer -------------------------------------------------------

describe("createGuestPlayer", () => {
  it("roept create_guest_player met p_name en geeft het id terug", async () => {
    enqueue({ data: "guest-1" });
    const id = await createGuestPlayer("Charlie");
    expect(id).toBe("guest-1");
    expect(calls).toContainEqual({
      method: "rpc",
      name: "create_guest_player",
      args: [{ p_name: "Charlie" }],
    });
  });

  it("gooit door bij een fout", async () => {
    enqueue({ error: new Error("guest stuk") });
    await expect(createGuestPlayer("Charlie")).rejects.toThrow("guest stuk");
  });
});

// --- deleteMatch -------------------------------------------------------------

describe("deleteMatch", () => {
  it("roept delete_match met p_match_id", async () => {
    enqueue({ error: null });
    await deleteMatch("m1");
    expect(calls).toContainEqual({
      method: "rpc",
      name: "delete_match",
      args: [{ p_match_id: "m1" }],
    });
  });

  it("gooit door bij een fout", async () => {
    enqueue({ error: new Error("delete stuk") });
    await expect(deleteMatch("m1")).rejects.toThrow("delete stuk");
  });
});

// --- replaceMatchPlayer ------------------------------------------------------

describe("replaceMatchPlayer", () => {
  it("roept replace_match_player met match, gast en vervanger", async () => {
    enqueue({ error: null });
    await replaceMatchPlayer("m1", "g1", "p5");
    expect(calls).toContainEqual({
      method: "rpc",
      name: "replace_match_player",
      args: [{ p_match_id: "m1", p_from_player: "g1", p_to_player: "p5" }],
    });
  });

  it("gooit de weigering van de RPC door", async () => {
    enqueue({ error: new Error("Die speler staat al in deze match") });
    await expect(replaceMatchPlayer("m1", "g1", "p2")).rejects.toThrow(
      "Die speler staat al in deze match",
    );
  });
});
