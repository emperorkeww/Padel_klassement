import { describe, it, expect } from "vitest";
import {
  groupRivalries,
  nextEncounter,
  pairKey,
  rivalryForMatch,
  rivalryHeadline,
  standAfter,
} from "@/features/groups/rivalry";
import type { Match, Team } from "@/types";

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
  played_at: `2026-07-0${(seq % 9) + 1}T19:00:00.000Z`,
  created_at: "2026-06-01T18:00:00.000Z",
  created_by: null,
  group_id: "g1",
  round_number: null,
  format: "2v2",
  ...over,
});

/** n duels t-ab vs t-cd op oplopende dagen, winnaar per duel via `winners`. */
const duels = (winners: Array<"t-ab" | "t-cd" | null>): Match[] =>
  winners.map((w, i) =>
    match({
      winner_team_id: w,
      played_at: `2026-06-${String(i + 1).padStart(2, "0")}T19:00:00.000Z`,
    }),
  );

const NAMES: Record<string, string> = { a: "Alice", b: "Bob", c: "Carol", d: "Daan" };
const nameOf = (id: string) => NAMES[id];

describe("groupRivalries", () => {
  it("telt de vier kruisparen en nooit partners", () => {
    const rs = groupRivalries(duels(["t-ab", "t-ab", "t-ab"]), TEAMS);
    // 4 kruisparen (a-c, a-d, b-c, b-d), geen a-b of c-d.
    expect(rs).toHaveLength(4);
    expect(rs.map((r) => pairKey(r.a, r.b)).sort()).toEqual([
      "a|c",
      "a|d",
      "b|c",
      "b|d",
    ]);
    const ac = rs.find((r) => pairKey(r.a, r.b) === "a|c")!;
    expect(ac).toMatchObject({ played: 3, winsA: 3, winsB: 0, draws: 0 });
  });

  it("negeert niet-afgeronde matches en ontbrekende teams", () => {
    const rs = groupRivalries(
      [
        ...duels(["t-ab", "t-ab", "t-ab"]),
        match({ status: "scheduled", winner_team_id: null }),
        match({ status: "cancelled", winner_team_id: null }),
        match({ team_b_id: "t-onbekend" }),
      ],
      TEAMS,
    );
    expect(rs[0].played).toBe(3);
  });

  it("telt gelijkspelen in played en draws, niet als winst", () => {
    const rs = groupRivalries(duels(["t-ab", null, null]), TEAMS);
    const ac = rs.find((r) => pairKey(r.a, r.b) === "a|c")!;
    expect(ac).toMatchObject({ played: 3, winsA: 1, winsB: 0, draws: 2 });
  });

  it("laat paren onder de duel-drempel weg", () => {
    expect(groupRivalries(duels(["t-ab", "t-ab"]), TEAMS)).toHaveLength(0);
    expect(groupRivalries(duels(["t-ab", "t-ab"]), TEAMS, 2)).toHaveLength(4);
  });

  it("rangschikt een gelijke stand boven een eenzijdige", () => {
    // Zelfde aantal duels: 3-3 is spannender dan 6-0.
    const gelijk = groupRivalries(
      duels(["t-ab", "t-cd", "t-ab", "t-cd", "t-ab", "t-cd"]),
      TEAMS,
    )[0];
    const eenzijdig = groupRivalries(
      duels(["t-ab", "t-ab", "t-ab", "t-ab", "t-ab", "t-ab"]),
      TEAMS,
    )[0];
    expect(gelijk.score).toBeGreaterThan(eenzijdig.score);
  });

  it("telt een leidingwissel ook als die via een gelijke stand loopt", () => {
    // a wint, dan wint c drie keer: de leiding gaat via 1-1 naar c.
    const r = groupRivalries(
      duels(["t-ab", "t-cd", "t-cd", "t-cd"]),
      TEAMS,
    )[0];
    expect(r.leadChanges).toBe(1);
    // Zonder kruising blijft de teller op nul.
    const eenzijdig = groupRivalries(
      duels(["t-cd", "t-cd", "t-ab", "t-cd"]),
      TEAMS,
    )[0];
    expect(eenzijdig.leadChanges).toBe(0);
  });

  it("weegt een recente leidingwissel zwaarder dan een oude", () => {
    // Beide reeksen: 7 duels, één duel verschil in de stand, precies één
    // wissel — alleen het moment verschilt (duel 3 vs laatste duel).
    const vroeg = groupRivalries(
      duels(["t-ab", "t-cd", "t-cd", "t-ab", "t-cd", "t-ab", "t-cd"]),
      TEAMS,
    )[0];
    const laat = groupRivalries(
      duels(["t-cd", "t-cd", "t-ab", "t-ab", "t-cd", "t-ab", "t-ab"]),
      TEAMS,
    )[0];
    expect(vroeg.leadChanges).toBe(1);
    expect(laat.leadChanges).toBe(1);
    expect(vroeg.played).toBe(laat.played);
    expect(Math.abs(vroeg.winsA - vroeg.winsB)).toBe(
      Math.abs(laat.winsA - laat.winsB),
    );
    expect(laat.score).toBeGreaterThan(vroeg.score);
  });

  it("onthoudt het recentste duel en de winnaar per kant", () => {
    const rs = groupRivalries(duels(["t-ab", "t-cd"]), TEAMS, 2);
    const ac = rs.find((r) => pairKey(r.a, r.b) === "a|c")!;
    expect(ac.last.winnerId).toBe("c");
    expect(ac.last.match.played_at).toContain("2026-06-02");
  });
});

describe("rivalryForMatch", () => {
  it("kiest het hoogst scorende van de vier kruisparen", () => {
    // a-c spannend (2-2), overige paren volgen dezelfde uitslagen; maak a-c
    // uniek spannender door extra duels in andere teamsamenstelling.
    const history = [
      ...duels(["t-ab", "t-cd", "t-ab", "t-cd"]),
      // Extra a-tegen-c duels via t-ab vs t-ca bestaan niet; gebruik t-ac vs
      // t-bd om b-c en a-d óók duels te geven maar met eenzijdige uitslag.
      match({ team_a_id: "t-ac", team_b_id: "t-bd", winner_team_id: "t-ac", played_at: "2026-06-10T19:00:00.000Z" }),
      match({ team_a_id: "t-ac", team_b_id: "t-bd", winner_team_id: "t-ac", played_at: "2026-06-11T19:00:00.000Z" }),
      match({ team_a_id: "t-ac", team_b_id: "t-bd", winner_team_id: "t-ac", played_at: "2026-06-12T19:00:00.000Z" }),
    ];
    const rs = groupRivalries(history, TEAMS);
    const planned = match({ status: "scheduled", winner_team_id: null });
    const r = rivalryForMatch(planned, TEAMS, rs);
    expect(r).not.toBeNull();
    expect(r!.score).toBe(Math.max(...rs
      .filter((x) => ["a|c", "a|d", "b|c", "b|d"].includes(pairKey(x.a, x.b)))
      .map((x) => x.score)));
  });

  it("geeft null zonder rivaliteit boven de drempel", () => {
    const rs = groupRivalries(duels(["t-ab"]), TEAMS);
    expect(rivalryForMatch(match({}), TEAMS, rs)).toBeNull();
  });
});

describe("nextEncounter", () => {
  it("vindt de vroegste geplande confrontatie en slaat cancelled over", () => {
    const later = match({
      status: "scheduled",
      winner_team_id: null,
      played_at: "2026-07-20T20:00:00.000Z",
    });
    const eerder = match({
      status: "scheduled",
      winner_team_id: null,
      played_at: "2026-07-15T20:00:00.000Z",
    });
    const afgelast = match({
      status: "cancelled",
      winner_team_id: null,
      played_at: "2026-07-12T20:00:00.000Z",
    });
    expect(nextEncounter([later, afgelast, eerder], TEAMS, "a", "c")?.id).toBe(
      eerder.id,
    );
  });

  it("geeft null als de spelers niet tegenover elkaar staan", () => {
    const partners = match({ status: "scheduled", winner_team_id: null });
    expect(nextEncounter([partners], TEAMS, "a", "b")).toBeNull();
  });
});

describe("standAfter en rivalryHeadline", () => {
  const rivalry = (winsA: number, winsB: number, draws = 0) => {
    const base = groupRivalries(duels(["t-ab", "t-ab", "t-ab"]), TEAMS)[0];
    return { ...base, a: "a", b: "b", winsA, winsB, draws };
  };

  it("telt één duel bij de juiste kant op", () => {
    expect(standAfter(rivalry(5, 3), "a")).toEqual({ winsA: 6, winsB: 3, draws: 0 });
    expect(standAfter(rivalry(5, 3), "b")).toEqual({ winsA: 5, winsB: 4, draws: 0 });
    expect(standAfter(rivalry(5, 3, 1), null)).toEqual({ winsA: 5, winsB: 3, draws: 2 });
  });

  it("kiest de juiste kop per situatie", () => {
    // Bob wint maar blijft achter: 5-3 → 5-4.
    expect(rivalryHeadline(rivalry(5, 3), "b", nameOf)).toBe(
      "Bob slaat terug: 4–5 tegen Alice!",
    );
    // Bob komt gelijk: 5-4 → 5-5.
    expect(rivalryHeadline(rivalry(5, 4), "b", nameOf)).toBe(
      "Bob komt langszij met Alice: 5–5!",
    );
    // Bob pakt de leiding: 5-5 → 5-6.
    expect(rivalryHeadline(rivalry(5, 5), "b", nameOf)).toBe(
      "Bob pakt de leiding: 6–5 tegen Alice!",
    );
    // Alice loopt uit: 5-3 → 6-3.
    expect(rivalryHeadline(rivalry(5, 3), "a", nameOf)).toBe(
      "Alice loopt verder uit: 6–3 tegen Bob!",
    );
    // Gelijkspel: stand blijft.
    expect(rivalryHeadline(rivalry(5, 3), null, nameOf)).toBe(
      "Gelijkspel — de stand blijft 5–3.",
    );
  });
});
