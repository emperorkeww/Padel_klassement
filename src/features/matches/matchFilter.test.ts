import { describe, it, expect } from "vitest";
import {
  applyFilter,
  filterOpGroep,
  filterOpPeriode,
  groupByDay,
  dayLabel,
  periodeFromParam,
  EMPTY_BY_FILTER,
  FILTER_TABS,
  PERIODE_OPTIES,
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

// ── #914: groep en periode versmallen de lijst vóór de tabs hierboven ────────

/** Match op een vaste dag, met een group_id. */
const opDag = (id: string, dag: string, groupId: string | null): Match =>
  ({
    id,
    team_a_id: "ta",
    team_b_id: "tb",
    status: "completed",
    group_id: groupId,
    played_at: `${dag}T18:00:00.000Z`,
    created_at: `${dag}T18:00:00.000Z`,
  }) as unknown as Match;

describe("filterOpGroep (#914)", () => {
  const lijst = [
    opDag("a", "2026-07-01", "g1"),
    opDag("b", "2026-07-01", "g2"),
    opDag("c", "2026-07-01", null),
  ];

  it("laat alles door zonder gekozen groep", () => {
    expect(filterOpGroep(lijst, "")).toHaveLength(3);
  });

  it("houdt alleen de matches van die groep", () => {
    expect(filterOpGroep(lijst, "g1").map((m) => m.id)).toEqual(["a"]);
  });

  it("laat losse matches zonder groep buiten een groepsfilter", () => {
    expect(filterOpGroep(lijst, "g2").map((m) => m.id)).toEqual(["b"]);
  });
});

describe("filterOpPeriode (#914)", () => {
  // "Nu" is 10 juli 2026, 12:00 UTC.
  const nu = Date.UTC(2026, 6, 10, 12);
  const lijst = [
    opDag("vandaag", "2026-07-10", null),
    opDag("zesDagen", "2026-07-04", null),
    opDag("achtDagen", "2026-07-02", null),
    opDag("vorigJaar", "2025-12-30", null),
  ];

  it("laat alles door zonder periode", () => {
    expect(filterOpPeriode(lijst, "", "UTC", nu)).toHaveLength(4);
  });

  it("telt bij 7 dagen vandaag mee en kapt op de zevende dag af", () => {
    // Vandaag t/m zes dagen terug = zeven dagen; de achtste valt af.
    const ids = filterOpPeriode(lijst, "7d", "UTC", nu).map((m) => m.id);
    expect(ids).toEqual(["vandaag", "zesDagen"]);
  });

  it("neemt bij 30 dagen ook de oudere match uit dezelfde maand mee", () => {
    const ids = filterOpPeriode(lijst, "30d", "UTC", nu).map((m) => m.id);
    expect(ids).toEqual(["vandaag", "zesDagen", "achtDagen"]);
  });

  it("beperkt 'dit jaar' tot het lopende kalenderjaar", () => {
    const ids = filterOpPeriode(lijst, "jaar", "UTC", nu).map((m) => m.id);
    expect(ids).not.toContain("vorigJaar");
    expect(ids).toHaveLength(3);
  });

  it("rekent in de clubtijdzone, niet in UTC", () => {
    // 23:30 UTC op 3 juli is in Brussel al 4 juli (zomertijd, +2). Binnen
    // "laatste 7 dagen" telt hij daardoor wél mee.
    const laat = opDag("grens", "2026-07-03", null);
    laat.played_at = "2026-07-03T23:30:00.000Z";
    expect(
      filterOpPeriode([laat], "7d", "Europe/Brussels", nu).map((m) => m.id),
    ).toEqual(["grens"]);
    expect(filterOpPeriode([laat], "7d", "UTC", nu)).toHaveLength(0);
  });
});

describe("periodeFromParam (#914)", () => {
  it("accepteert elke bekende sleutel", () => {
    for (const [k] of PERIODE_OPTIES) expect(periodeFromParam(k)).toBe(k);
  });

  it("valt bij onzin of ontbreken terug op alle tijden", () => {
    expect(periodeFromParam("gisteren")).toBe("");
    expect(periodeFromParam(null)).toBe("");
  });
});
