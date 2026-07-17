import { describe, it, expect } from "vitest";
import {
  vendettaKop,
  vendettaStand,
  vendettaTaunt,
  type VendettaContract,
} from "@/features/groups/vendetta";
import type { Match, Team } from "@/types";

// Challenger "a" en rivaal "c" staan tegenover elkaar in t-ab vs t-cd; in
// t-ac zijn ze partners (telt nooit mee).
const TEAMS: Record<string, Team> = {
  "t-ab": { id: "t-ab", name: null, player1_id: "a", player2_id: "b", created_at: "x" },
  "t-cd": { id: "t-cd", name: null, player1_id: "c", player2_id: "d", created_at: "x" },
  "t-ac": { id: "t-ac", name: null, player1_id: "a", player2_id: "c", created_at: "x" },
  "t-bd": { id: "t-bd", name: null, player1_id: "b", player2_id: "d", created_at: "x" },
};

let seq = 0;
const match = (over: Partial<Match>): Match => ({
  id: `m${++seq}`,
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "completed",
  winner_team_id: "t-ab",
  score_a: 6,
  score_b: 3,
  played_at: "2026-07-01T19:00:00.000Z",
  created_at: "2026-06-01T18:00:00.000Z",
  created_by: null,
  group_id: "g1",
  round_number: null,
  format: "2v2",
  ...over,
});

/** Duels t-ab vs t-cd op oplopende dagen; winnaar per duel via `winners`. */
const duels = (winners: Array<"t-ab" | "t-cd" | null>, vanafDag = 1): Match[] =>
  winners.map((w, i) =>
    match({
      winner_team_id: w,
      played_at: `2026-07-${String(vanafDag + i).padStart(2, "0")}T19:00:00.000Z`,
    }),
  );

const contract = (over: Partial<VendettaContract> = {}): VendettaContract => ({
  challenger_id: "a",
  rival_id: "c",
  target_wins: 5,
  started_at: "2026-07-01T00:00:00.000Z",
  ...over,
});

describe("vendettaStand", () => {
  it("telt wins, draws en de leider uit onderlinge duels", () => {
    const stand = vendettaStand(
      contract(),
      duels(["t-ab", "t-cd", null, "t-ab"]),
      TEAMS,
    );
    expect(stand.played).toBe(4);
    expect(stand.winsChallenger).toBe(2);
    expect(stand.winsRival).toBe(1);
    expect(stand.draws).toBe(1);
    expect(stand.leiderId).toBe("a");
    expect(stand.beslist).toBeNull();
  });

  it("negeert duels van vóór de start en niet-onderlinge matches", () => {
    const oud = duels(["t-cd"], 1); // 1 juli, vóór start 2 juli
    const partners = match({
      team_a_id: "t-ac",
      team_b_id: "t-bd",
      winner_team_id: "t-ac",
      played_at: "2026-07-05T19:00:00.000Z",
    });
    const echt = duels(["t-ab"], 3);
    const stand = vendettaStand(
      contract({ started_at: "2026-07-02T00:00:00.000Z" }),
      [...oud, partners, ...echt],
      TEAMS,
    );
    expect(stand.played).toBe(1);
    expect(stand.winsChallenger).toBe(1);
    expect(stand.winsRival).toBe(0);
  });

  it("registreert omslagen alleen bij een échte leidingswissel", () => {
    // a leidt 1-0, gelijk 1-1, c pakt over 1-2, gelijk 2-2, a pakt terug 3-2.
    const stand = vendettaStand(
      contract(),
      duels(["t-ab", "t-cd", "t-cd", "t-ab", "t-ab"]),
      TEAMS,
    );
    expect(stand.omslagen.map((o) => o.nieuweLeiderId)).toEqual(["c", "a"]);
  });

  it("beslist op het doel en bevriest daarna", () => {
    const stand = vendettaStand(
      contract({ target_wins: 3 }),
      // a haalt 3 zeges in duel 4; het vijfde duel (winst c) telt niet meer.
      duels(["t-ab", "t-ab", "t-cd", "t-ab", "t-cd"]),
      TEAMS,
    );
    expect(stand.beslist?.winnaarId).toBe("a");
    expect(stand.beslist?.match.id).toBe(stand.laatste?.match.id);
    expect(stand.winsChallenger).toBe(3);
    expect(stand.winsRival).toBe(1);
    expect(stand.played).toBe(4);
  });

  it("werkt ook bij singles (1v1)", () => {
    const teams: Record<string, Team> = {
      "t-a": { id: "t-a", name: null, player1_id: "a", player2_id: null, created_at: "x" },
      "t-c": { id: "t-c", name: null, player1_id: "c", player2_id: null, created_at: "x" },
    };
    const m = match({
      team_a_id: "t-a",
      team_b_id: "t-c",
      winner_team_id: "t-c",
      format: "1v1",
    });
    const stand = vendettaStand(contract(), [m], teams);
    expect(stand.winsRival).toBe(1);
    expect(stand.leiderId).toBe("c");
  });
});

describe("vendettaKop", () => {
  const naam = (id: string) => (id === "a" ? "An" : "Cas");

  it("benoemt de leider vanuit diens perspectief", () => {
    const stand = vendettaStand(
      contract(),
      duels(["t-cd", "t-cd", "t-ab"]),
      TEAMS,
    );
    expect(vendettaKop(stand, contract(), naam)).toBe("Cas leidt 2–1");
  });

  it("gelijke stand en lege stand krijgen hun eigen kop", () => {
    const gelijk = vendettaStand(contract(), duels(["t-ab", "t-cd"]), TEAMS);
    expect(vendettaKop(gelijk, contract(), naam)).toBe("Gelijk 1–1");
    const leeg = vendettaStand(contract(), [], TEAMS);
    expect(vendettaKop(leeg, contract(), naam)).toContain("Nog geen duels");
  });
});

describe("vendettaTaunt", () => {
  it("vult winnaar, verliezer en stand in en is deterministisch per seed", () => {
    const input = {
      winnaar: "An",
      verliezer: "Cas",
      stand: "4–2",
      intensiteit: "gemeen" as const,
      seed: 42,
    };
    const taunt = vendettaTaunt(input);
    expect(taunt).toContain("An");
    expect(taunt).toContain("4–2");
    expect(taunt).not.toContain("{winnaar}");
    expect(taunt).not.toContain("{stand}");
    expect(vendettaTaunt(input)).toBe(taunt);
  });

  it("elke intensiteit levert een gevulde taunt", () => {
    for (const intensiteit of ["mild", "gemeen", "radioactief"] as const) {
      const t = vendettaTaunt({
        winnaar: "An",
        verliezer: "Cas",
        stand: "1–0",
        intensiteit,
        seed: 7,
      });
      expect(t.length).toBeGreaterThan(10);
      expect(t).not.toContain("{");
    }
  });
});
