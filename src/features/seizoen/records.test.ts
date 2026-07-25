import { describe, it, expect } from "vitest";
import { groepsRecords, type RecordId } from "@/features/seizoen/records";
import type { Match, Profile, Team } from "@/types";

const TEAMS: Record<string, Team> = {
  "t-ab": { id: "t-ab", name: null, player1_id: "a", player2_id: "b", created_at: "x" },
  "t-cd": { id: "t-cd", name: null, player1_id: "c", player2_id: "d", created_at: "x" },
  "t-ac": { id: "t-ac", name: null, player1_id: "a", player2_id: "c", created_at: "x" },
  "t-bd": { id: "t-bd", name: null, player1_id: "b", player2_id: "d", created_at: "x" },
  "t-a": { id: "t-a", name: null, player1_id: "a", player2_id: null, created_at: "x" },
  "t-c": { id: "t-c", name: null, player1_id: "c", player2_id: null, created_at: "x" },
};

const profile = (id: string, over: Partial<Profile> = {}): Profile => ({
  id,
  username: id,
  full_name: id.toUpperCase(),
  avatar_url: null,
  created_at: "2026-01-01T00:00:00",
  ...over,
});

const PROFILES: Record<string, Profile> = {
  a: profile("a"),
  b: profile("b"),
  c: profile("c"),
  d: profile("d"),
};

let seq = 0;
const match = (over: Partial<Match> = {}): Match => ({
  id: `m${++seq}`,
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "completed",
  winner_team_id: "t-ab",
  score_a: 6,
  score_b: 4,
  played_at: `2026-03-${String(seq).padStart(2, "0")}T19:00:00`,
  created_at: "2026-03-01T18:00:00",
  created_by: null,
  group_id: "g1",
  round_number: null,
  format: "2v2",
  ...over,
});

const rec = (records: ReturnType<typeof groepsRecords>, id: RecordId) =>
  records.find((r) => r.id === id);

describe("groepsRecords", () => {
  it("geeft niets zonder afgeronde matches", () => {
    expect(groepsRecords([], TEAMS, PROFILES)).toEqual([]);
    expect(
      groepsRecords(
        [match({ status: "scheduled", winner_team_id: null })],
        TEAMS,
        PROFILES,
      ),
    ).toEqual([]);
  });

  it("vindt de langste winreeks met de match die hem afsloot", () => {
    const ms = [match(), match(), match(), match({ winner_team_id: "t-cd", score_a: 3, score_b: 6 })];
    const r = rec(groepsRecords(ms, TEAMS, PROFILES), "winreeks")!;
    expect(r.waarde).toBe(3);
    expect(r.detail).toBe("3 op rij");
    // a en b wonnen samen drie keer; de tie-break op playerId kiest 'a'.
    expect(r.houders).toEqual(["a"]);
    expect(r.matchId).toBe(ms[2].id);
    expect(r.datum).toBe(ms[2].played_at!.slice(0, 10));
  });

  it("laat de winreeks weg onder de drempel van 3", () => {
    const ms = [match(), match({ winner_team_id: "t-cd", score_a: 2, score_b: 6 })];
    expect(rec(groepsRecords(ms, TEAMS, PROFILES), "winreeks")).toBeUndefined();
  });

  it("kent de grootste zege toe aan het winnende team", () => {
    const ms = [
      match({ score_a: 6, score_b: 2 }),
      match({ score_a: 6, score_b: 0 }),
      match({ score_a: 6, score_b: 3 }),
    ];
    const r = rec(groepsRecords(ms, TEAMS, PROFILES), "zege")!;
    expect(r.waarde).toBe(6);
    expect(r.detail).toBe("6 games verschil");
    expect(r.houders.sort()).toEqual(["a", "b"]);
    expect(r.matchId).toBe(ms[1].id);
  });

  it("houdt bij gelijke marge het eerste record", () => {
    const ms = [match({ score_a: 6, score_b: 0 }), match({ score_a: 6, score_b: 0 })];
    expect(rec(groepsRecords(ms, TEAMS, PROFILES), "zege")!.matchId).toBe(ms[0].id);
  });

  it("telt gelijkspel mee voor de ongeslagen reeks van een duo", () => {
    const ms = [
      match({ winner_team_id: null, score_a: 5, score_b: 5 }),
      match(),
      match(),
    ];
    const r = rec(groepsRecords(ms, TEAMS, PROFILES), "duo")!;
    expect(r.waarde).toBe(3);
    expect(r.detail).toBe("3 ongeslagen");
    expect(r.houders).toEqual(["a", "b"]);
  });

  it("rekent een singles-team niet als duo", () => {
    const ms = [
      match({ team_a_id: "t-a", team_b_id: "t-c", winner_team_id: "t-a", format: "1v1" }),
      match({ team_a_id: "t-a", team_b_id: "t-c", winner_team_id: "t-a", format: "1v1" }),
      match({ team_a_id: "t-a", team_b_id: "t-c", winner_team_id: "t-a", format: "1v1" }),
    ];
    expect(rec(groepsRecords(ms, TEAMS, PROFILES), "duo")).toBeUndefined();
    // De winreeks van de speler zelf blijft wél staan.
    expect(rec(groepsRecords(ms, TEAMS, PROFILES), "winreeks")!.houders).toEqual(["a"]);
  });

  it("vindt de drukste dag van één speler", () => {
    const zelfdeDag = (n: number) =>
      match({ played_at: `2026-03-14T${String(17 + n).padStart(2, "0")}:00:00` });
    const ms = [zelfdeDag(0), zelfdeDag(1), zelfdeDag(2)];
    const r = rec(groepsRecords(ms, TEAMS, PROFILES), "avond")!;
    expect(r.waarde).toBe(3);
    expect(r.detail).toBe("3 matches");
    expect(r.datum).toBe("2026-03-14");
  });

  it("telt matches over verschillende dagen niet als één avond", () => {
    const ms = [
      match({ played_at: "2026-03-01T19:00:00" }),
      match({ played_at: "2026-03-02T19:00:00" }),
      match({ played_at: "2026-03-03T19:00:00" }),
    ];
    expect(rec(groepsRecords(ms, TEAMS, PROFILES), "avond")).toBeUndefined();
  });

  it("telt bagels alleen voor de uitdelende kant", () => {
    const ms = [
      match({ score_a: 6, score_b: 0 }),
      match({ score_a: 6, score_b: 0 }),
      match({ winner_team_id: "t-cd", score_a: 0, score_b: 6 }),
    ];
    const r = rec(groepsRecords(ms, TEAMS, PROFILES), "bagels")!;
    expect(r.waarde).toBe(2);
    expect(r.detail).toBe("2 bagels");
    expect(r.houders).toEqual(["a"]);
  });

  it("noemt één bagel enkelvoud", () => {
    const r = rec(groepsRecords([match({ score_a: 6, score_b: 0 })], TEAMS, PROFILES), "bagels")!;
    expect(r.detail).toBe("1 bagel");
  });

  it("rekent 0-0 niet als bagel", () => {
    const ms = [match({ winner_team_id: null, score_a: 0, score_b: 0 })];
    expect(rec(groepsRecords(ms, TEAMS, PROFILES), "bagels")).toBeUndefined();
  });

  it("houdt gasten buiten de records", () => {
    const metGast = { ...PROFILES, a: profile("a", { is_guest: true }) };
    const ms = [match(), match(), match()];
    const records = groepsRecords(ms, TEAMS, metGast);
    // De winreeks gaat naar b; a is gast en komt nergens als houder voor.
    expect(rec(records, "winreeks")!.houders).toEqual(["b"]);
    for (const r of records) expect(r.houders).not.toContain("a");
    // Een duo met een gast erin is geen recordhouder.
    expect(rec(records, "duo")).toBeUndefined();
  });

  it("houdt de records in vaste volgorde", () => {
    const ms = [
      match({ score_a: 6, score_b: 0, played_at: "2026-03-14T17:00:00" }),
      match({ score_a: 6, score_b: 0, played_at: "2026-03-14T18:00:00" }),
      match({ score_a: 6, score_b: 0, played_at: "2026-03-14T19:00:00" }),
    ];
    expect(groepsRecords(ms, TEAMS, PROFILES).map((r) => r.id)).toEqual([
      "winreeks",
      "zege",
      "duo",
      "avond",
      "bagels",
    ]);
  });
});
