import { describe, it, expect } from "vitest";
import {
  bestWeekday,
  courtPreference,
  monthlyWinRate,
  opponentExtremes,
  timeOfDayPreference,
} from "@/features/profiles/trends";
import type { CourtType, Match, Team } from "@/types";

// p1 speelt met p2 (team t-a) tegen p3+p4 (team t-b).
const TEAMS: Record<string, Team> = {
  "t-a": { id: "t-a", player1_id: "p1", player2_id: "p2" } as Team,
  "t-b": { id: "t-b", player1_id: "p3", player2_id: "p4" } as Team,
  "t-c": { id: "t-c", player1_id: "p5", player2_id: "p6" } as Team,
};

let seq = 0;
function match(playedAt: string, won: boolean, opp: "t-b" | "t-c" = "t-b"): Match {
  return {
    id: `m-${seq++}`,
    team_a_id: "t-a",
    team_b_id: opp,
    status: "completed",
    winner_team_id: won ? "t-a" : opp,
    played_at: playedAt,
    created_at: playedAt,
  } as Match;
}

describe("monthlyWinRate", () => {
  it("groepeert per maand, oplopend, met win%", () => {
    const trends = monthlyWinRate(
      [
        match("2026-05-10T18:00:00Z", true),
        match("2026-05-20T18:00:00Z", false),
        match("2026-06-05T18:00:00Z", true),
      ],
      TEAMS,
      "p1",
    );
    expect(trends.map((t) => `${t.month}:${t.rate}`)).toEqual([
      "2026-05:50",
      "2026-06:100",
    ]);
    expect(trends[0].label).toBe("mei");
  });

  it("beperkt tot de laatste N maanden met matches", () => {
    const list = ["2026-01", "2026-02", "2026-03", "2026-04"].map((m) =>
      match(`${m}-10T18:00:00Z`, true),
    );
    const trends = monthlyWinRate(list, TEAMS, "p1", 2);
    expect(trends.map((t) => t.month)).toEqual(["2026-03", "2026-04"]);
  });
});

describe("opponentExtremes", () => {
  it("vindt de sterkste (meer winst) en lastigste (meer verlies) tegenstander", () => {
    const list = [
      // Tegen t-b: 3-1 → sterkst.
      match("2026-05-01T18:00:00Z", true),
      match("2026-05-02T18:00:00Z", true),
      match("2026-05-03T18:00:00Z", true),
      match("2026-05-04T18:00:00Z", false),
      // Tegen t-c: 0-2 → lastigst.
      match("2026-05-05T18:00:00Z", false, "t-c"),
      match("2026-05-06T18:00:00Z", false, "t-c"),
    ];
    const { favorite, hardest } = opponentExtremes(list, TEAMS, "p1");
    expect(favorite?.oppId).toBe("p3"); // (of p4 — zelfde team, zelfde record)
    expect(favorite?.rate).toBe(75);
    expect(hardest?.oppId).toBe("p5");
    expect(hardest?.rate).toBe(0);
  });

  it("licht niemand uit onder de minimumgrens of bij een blanco balans", () => {
    const { favorite, hardest } = opponentExtremes(
      [match("2026-05-01T18:00:00Z", true)], // 1 duel < minGames
      TEAMS,
      "p1",
    );
    expect(favorite).toBeNull();
    expect(hardest).toBeNull();
  });
});

describe("bestWeekday", () => {
  it("kiest de weekdag met het hoogste win% (min. 3 matches)", () => {
    // 2026-07-03 = vrijdag, 2026-07-06 = maandag.
    const list = [
      match("2026-07-03T18:00:00Z", true),
      match("2026-07-10T18:00:00Z", true),
      match("2026-07-17T18:00:00Z", true),
      match("2026-07-06T18:00:00Z", false),
      match("2026-07-13T18:00:00Z", false),
      match("2026-07-20T18:00:00Z", true),
    ];
    const best = bestWeekday(list, TEAMS, "p1");
    expect(best?.label).toBe("vrijdag");
    expect(best?.rate).toBe(100);
    expect(best?.played).toBe(3);
  });

  it("geeft null bij spelen op maar één weekdag", () => {
    const list = [
      match("2026-07-03T18:00:00Z", true),
      match("2026-07-10T18:00:00Z", true),
      match("2026-07-17T18:00:00Z", true),
    ];
    expect(bestWeekday(list, TEAMS, "p1")).toBeNull();
  });
});

// Lokale-tijd-strings (geen "Z") zodat getHours() los van de CI-tijdzone het
// bedoelde uur oplevert.
function matchAt(hourStr: string, won: boolean): Match {
  return {
    id: `mh-${seq++}`,
    team_a_id: "t-a",
    team_b_id: "t-b",
    status: "completed",
    winner_team_id: won ? "t-a" : "t-b",
    played_at: `2026-06-01T${hourStr}:00`,
    created_at: `2026-06-01T${hourStr}:00`,
  } as Match;
}

describe("timeOfDayPreference", () => {
  it("bucketeert per dagdeel in vaste volgorde met win%", () => {
    const { parts } = timeOfDayPreference(
      [
        matchAt("08:00", true), // ochtend
        matchAt("14:00", false), // middag
        matchAt("14:30", true), // middag
        matchAt("20:00", true), // avond
      ],
      TEAMS,
      "p1",
    );
    expect(parts.map((p) => `${p.part}:${p.rate}`)).toEqual([
      "ochtend:100",
      "middag:50",
      "avond:100",
    ]);
  });

  it("kiest het beste dagdeel met genoeg matches", () => {
    const { best } = timeOfDayPreference(
      [
        // avond: 3 matches, 3 winst
        matchAt("19:00", true),
        matchAt("20:00", true),
        matchAt("21:00", true),
        // ochtend: 1 match, onder de drempel ondanks 100%
        matchAt("07:00", true),
        matchAt("08:00", false),
        matchAt("09:00", false),
      ],
      TEAMS,
      "p1",
    );
    expect(best?.part).toBe("avond");
    expect(best?.label).toBe("Avond");
  });
});

function matchCourt(court: CourtType | null, won: boolean): Match {
  return {
    id: `mc-${seq++}`,
    team_a_id: "t-a",
    team_b_id: "t-b",
    status: "completed",
    winner_team_id: won ? "t-a" : "t-b",
    court_type: court,
    played_at: "2026-06-01T18:00:00Z",
    created_at: "2026-06-01T18:00:00Z",
  } as Match;
}

describe("courtPreference", () => {
  it("telt enkel matches mét baantype, in COURT_TYPES-volgorde", () => {
    const { courts } = courtPreference(
      [
        matchCourt("buiten", true),
        matchCourt("binnen", true),
        matchCourt("binnen", false),
        matchCourt(null, true), // zonder type: telt niet mee
      ],
      TEAMS,
      "p1",
    );
    expect(courts.map((c) => `${c.type}:${c.rate}`)).toEqual([
      "binnen:50",
      "buiten:100",
    ]);
  });

  it("kiest het beste baantype met genoeg matches", () => {
    const { best } = courtPreference(
      [
        matchCourt("panorama", true),
        matchCourt("panorama", true),
        matchCourt("panorama", true),
        matchCourt("buiten", false), // 1 match, onder de drempel
      ],
      TEAMS,
      "p1",
    );
    expect(best?.type).toBe("panorama");
  });
});
