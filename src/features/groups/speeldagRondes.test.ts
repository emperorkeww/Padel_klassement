import { describe, expect, it } from "vitest";
import {
  RONDE_MIN,
  rondeStart,
  rondesOpDag,
  rondesVoorDuur,
} from "./speeldagRondes";
import type { Match } from "@/types";

const optie = (date: string, start_time: string) => ({ date, start_time });

const match = (over: Partial<Match>): Match =>
  ({
    id: "m",
    team_a_id: "a",
    team_b_id: "b",
    status: "scheduled",
    created_at: "2026-07-29T17:00:00.000Z",
    played_at: null,
    round_number: null,
    ...over,
  }) as Match;

describe("rondesVoorDuur", () => {
  it("reserveert tien minuten voor klaarzetten en verdeelt de rest", () => {
    expect(rondesVoorDuur(60)).toBe(5);
    expect(rondesVoorDuur(90)).toBe(8);
    expect(rondesVoorDuur(120)).toBe(11);
  });

  it("gaat nooit onder nul bij een onrealistisch kort blok", () => {
    expect(rondesVoorDuur(10)).toBe(0);
    expect(rondesVoorDuur(0)).toBe(0);
  });
});

describe("rondeStart", () => {
  it("zet datum + clubtijd om naar een echt moment", () => {
    // Zomertijd in Brussel: UTC+2.
    expect(rondeStart(optie("2026-07-29", "19:30"), "Europe/Brussels")).toBe(
      "2026-07-29T17:30:00.000Z",
    );
  });

  it("blijft kloppen in de winter (DST-grens)", () => {
    // Wintertijd in Brussel: UTC+1.
    expect(rondeStart(optie("2026-12-15", "19:30"), "Europe/Brussels")).toBe(
      "2026-12-15T18:30:00.000Z",
    );
  });

  it("schuift tien minuten op per ronde", () => {
    const nul = rondeStart(optie("2026-07-29", "19:30"), "Europe/Brussels", 0);
    const drie = rondeStart(optie("2026-07-29", "19:30"), "Europe/Brussels", 3);
    expect(new Date(drie).getTime() - new Date(nul).getTime()).toBe(
      3 * RONDE_MIN * 60_000,
    );
  });
});

describe("rondesOpDag", () => {
  const tz = "Europe/Brussels";

  it("telt unieke rondes van die dag, niet de losse matches", () => {
    const matches = [
      match({ round_number: 7, played_at: "2026-07-29T17:30:00.000Z" }),
      match({ round_number: 7, played_at: "2026-07-29T17:30:00.000Z" }),
      match({ round_number: 8, played_at: "2026-07-29T17:40:00.000Z" }),
      match({ round_number: null, played_at: "2026-07-29T17:40:00.000Z" }),
    ];
    expect(rondesOpDag(matches, tz, "2026-07-29")).toBe(2);
  });

  it("valt terug op created_at zolang er nog geen starttijd is", () => {
    const matches = [match({ round_number: 3, created_at: "2026-07-29T17:00:00.000Z" })];
    expect(rondesOpDag(matches, tz, "2026-07-29")).toBe(1);
  });

  it("negeert rondes van een andere dag", () => {
    const matches = [
      match({ round_number: 3, played_at: "2026-07-28T17:30:00.000Z" }),
    ];
    expect(rondesOpDag(matches, tz, "2026-07-29")).toBe(0);
  });

  it("rekent in clubtijd, niet in UTC", () => {
    // 23:30 UTC = 01:30 Brusselse tijd op 30 juli.
    const matches = [
      match({ round_number: 1, played_at: "2026-07-29T23:30:00.000Z" }),
    ];
    expect(rondesOpDag(matches, tz, "2026-07-30")).toBe(1);
    expect(rondesOpDag(matches, tz, "2026-07-29")).toBe(0);
  });
});
