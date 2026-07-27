import { describe, it, expect } from "vitest";
import {
  applyFilter,
  groupByDay,
  dayLabel,
  EMPTY_BY_FILTER,
  FILTER_TABS,
} from "./matchFilter";
import type { Match, Team } from "@/types";

const teams: Record<string, Team> = {
  ta: { id: "ta", player1_id: "me", player2_id: "p2" } as Team,
  tb: { id: "tb", player1_id: "p3", player2_id: "p4" } as Team,
  tc: { id: "tc", player1_id: "p5", player2_id: "p6" } as Team,
};

function match(over: Partial<Match>): Match {
  return {
    id: "m",
    team_a_id: "ta",
    team_b_id: "tb",
    status: "completed",
    winner_team_id: "ta",
    score_a: 6,
    score_b: 3,
    played_at: "2026-07-14T18:00:00Z",
    created_at: "2026-07-14T18:00:00Z",
    ...over,
  } as Match;
}

describe("applyFilter", () => {
  const won = match({ id: "won", winner_team_id: "ta" });
  const lost = match({ id: "lost", winner_team_id: "tb" });
  // Match zonder mij: team c vs team b.
  const other = match({ id: "other", team_a_id: "tc", winner_team_id: "tc" });
  const planned = match({
    id: "planned",
    status: "scheduled",
    winner_team_id: null,
    score_a: null,
    score_b: null,
  });
  const list = [won, lost, other, planned];

  it("'all' geeft alles ongefilterd terug", () => {
    expect(applyFilter(list, teams, "me", "all")).toEqual(list);
  });

  it("'won' geeft alleen mijn overwinningen", () => {
    expect(applyFilter(list, teams, "me", "won").map((m) => m.id)).toEqual([
      "won",
    ]);
  });

  it("'lost' geeft alleen mijn nederlagen", () => {
    expect(applyFilter(list, teams, "me", "lost").map((m) => m.id)).toEqual([
      "lost",
    ]);
  });

  it("'mine' neemt ook geplande matches waarin ik meedoe mee", () => {
    expect(
      new Set(applyFilter(list, teams, "me", "mine").map((m) => m.id)),
    ).toEqual(new Set(["won", "lost", "planned"]));
  });

  it("'mine' laat matches zonder mij weg", () => {
    expect(applyFilter(list, teams, "me", "mine").map((m) => m.id)).not.toContain(
      "other",
    );
  });
});

describe("groupByDay", () => {
  it("groepeert opeenvolgende matches van dezelfde dag", () => {
    const a = match({ id: "a", played_at: "2026-07-14T18:00:00Z" });
    const b = match({ id: "b", played_at: "2026-07-14T20:00:00Z" });
    const c = match({ id: "c", played_at: "2026-07-10T20:00:00Z" });
    const out = groupByDay([a, b, c], "UTC");
    expect(out).toHaveLength(2);
    expect(out[0].list.map((m) => m.id)).toEqual(["a", "b"]);
    expect(out[1].list.map((m) => m.id)).toEqual(["c"]);
  });

  it("valt terug op created_at als played_at ontbreekt", () => {
    const a = match({ id: "a", played_at: null, created_at: "2026-07-14T18:00:00Z" });
    expect(groupByDay([a], "UTC")).toHaveLength(1);
  });
});

describe("dayLabel", () => {
  it("noemt vandaag 'Vandaag' en gisteren 'Gisteren'", () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    expect(dayLabel(today.toISOString(), "UTC")).toBe("Vandaag");
    expect(dayLabel(yesterday.toISOString(), "UTC")).toBe("Gisteren");
  });

  it("rekent in de opgegeven tijdzone, niet in UTC (#783)", async () => {
    // Een match om 00:30 lokale tijd (net ná clubmiddernacht) valt in UTC
    // vaak nog op de vórige kalenderdag (zomertijd: 2 uur eerder). Toch is
    // het lokaal nog steeds "vandaag".
    const { dateInZone, clubEpoch } = await import("@/lib/utils/time");
    const brusselsToday = dateInZone("Europe/Brussels");
    const iso = new Date(
      clubEpoch(brusselsToday, "00:30", "Europe/Brussels"),
    ).toISOString();
    expect(dayLabel(iso, "Europe/Brussels")).toBe("Vandaag");
  });
});

describe("constanten", () => {
  it("heeft een lege-staat-tekst voor elk filter", () => {
    for (const [key] of FILTER_TABS) {
      expect(EMPTY_BY_FILTER[key]).toBeTruthy();
    }
  });
});
