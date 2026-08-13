import { describe, it, expect } from "vitest";
import { groupByRound, openGeplandeRonde } from "./groupDetailHelpers";
import type { Match } from "@/types";

const TZ = "Europe/Brussels";

function match(over: Partial<Match> = {}): Match {
  return {
    id: "m1",
    group_id: "g1",
    team_a_id: "t-a",
    team_b_id: "t-b",
    winner_team_id: null,
    score_a: null,
    score_b: null,
    set_scores: null,
    status: "scheduled",
    round_number: 1,
    played_at: "2026-09-04T18:00:00.000Z",
    created_at: "2026-09-04T12:00:00.000Z",
    created_by: "p1",
    court_type: null,
    client_token: null,
    ...over,
  } as Match;
}

describe("groupByRound (#1271)", () => {
  it("zet de rondes in speelvolgorde, losse matches vooraan", () => {
    // Het was aflopend: ronde 3 boven ronde 1, en "Losse matches" (ronde 0)
    // onder de hele avond in plaats van erboven.
    const rondes = groupByRound([
      match({ id: "a", round_number: 3 }),
      match({ id: "b", round_number: null }),
      match({ id: "c", round_number: 1 }),
      match({ id: "d", round_number: 2 }),
    ]);
    expect(rondes.map((r) => r.round)).toEqual([0, 1, 2, 3]);
  });

  it("houdt de matches van één ronde bij elkaar", () => {
    const rondes = groupByRound([
      match({ id: "a", round_number: 1 }),
      match({ id: "b", round_number: 1 }),
      match({ id: "c", round_number: 2 }),
    ]);
    expect(rondes[0].list.map((m) => m.id)).toEqual(["a", "b"]);
    expect(rondes[1].list.map((m) => m.id)).toEqual(["c"]);
  });
});

describe("openGeplandeRonde (#1271)", () => {
  it("vindt de vroegste ronde die nog uitslagen moet krijgen", () => {
    const open = openGeplandeRonde(
      [
        match({ id: "a", round_number: 2, played_at: "2026-09-11T18:00:00Z" }),
        match({ id: "b", round_number: 1, played_at: "2026-09-04T18:00:00Z" }),
      ],
      TZ,
    );
    expect(open).toEqual({ round: 1, dag: "2026-09-04" });
  });

  it("telt een geannuleerde match niet mee", () => {
    // Die levert nooit meer een uitslag op en blokkeerde Mexicano permanent.
    expect(
      openGeplandeRonde([match({ status: "cancelled" })], TZ),
    ).toBeNull();
  });

  it("telt een afgeronde match niet mee", () => {
    expect(
      openGeplandeRonde([match({ status: "completed" })], TZ),
    ).toBeNull();
  });

  it("valt terug op created_at zonder speeltijd", () => {
    const open = openGeplandeRonde(
      [match({ played_at: null, created_at: "2026-09-04T12:00:00Z" })],
      TZ,
    );
    expect(open?.dag).toBe("2026-09-04");
  });
});
