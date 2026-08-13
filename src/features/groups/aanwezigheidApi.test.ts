import { beforeEach, describe, expect, it, vi } from "vitest";

// #1271 — aanwezigheid verhuisde van localStorage naar play_poll_presence.
//
// Wat hier bewaakt wordt is de vorm van het schrijven, want daar zit de
// betekenis: bewaard worden de *afwijkingen* van de stemming, niet de hele
// lijst. "Terug naar wat de poll zegt" is de rij weghalen — zou je er `true` in
// zetten, dan hield een speler die je eerst afmeldde voor altijd een handmatige
// ja, ook als hij zijn stem intrekt.

const calls = vi.hoisted(() => [] as { method: string; args: unknown[] }[]);

const chain = vi.hoisted(() => {
  const maak = () => {
    const zelf: Record<string, unknown> = {};
    for (const m of ["select", "eq", "upsert", "delete", "not"]) {
      zelf[m] = (...args: unknown[]) => {
        calls.push({ method: m, args });
        return zelf;
      };
    }
    // Awaitbaar aan het eind van elke keten.
    zelf.then = (res: (v: { data: unknown[]; error: null }) => unknown) =>
      res({ data: [], error: null });
    return zelf;
  };
  return maak;
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: (t: string) => {
    calls.push({ method: "from", args: [t] });
    return chain();
  } },
}));

vi.mock("@/lib/supabase/queryCache", () => ({
  cached: (_sleutel: string, fn: () => unknown) => fn(),
  invalidate: (...prefixen: string[]) => {
    calls.push({ method: "invalidate", args: prefixen });
  },
}));

import { zetAanwezigheid, zetMijnAanwezigheid } from "./aanwezigheidApi";

describe("aanwezigheidApi (#1271)", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("schrijft de afwijkingen en ruimt de rest op", async () => {
    await zetAanwezigheid("opt-1", "g1", { p1: false, p2: true });

    const upsert = calls.find((c) => c.method === "upsert");
    expect(upsert?.args[0]).toEqual([
      expect.objectContaining({
        option_id: "opt-1",
        group_id: "g1",
        player_id: "p1",
        aanwezig: false,
      }),
      expect.objectContaining({ player_id: "p2", aanwezig: true }),
    ]);

    // En alles wat er niet in staat gaat weg: die spelers volgen weer de poll.
    const not = calls.find((c) => c.method === "not");
    expect(not?.args).toEqual(["player_id", "in", "(p1,p2)"]);
  });

  it("wist alles wanneer er geen enkele afwijking meer is", async () => {
    await zetAanwezigheid("opt-1", "g1", {});
    expect(calls.some((c) => c.method === "upsert")).toBe(false);
    expect(calls.some((c) => c.method === "delete")).toBe(true);
    // Zonder uitzonderingslijst: alles van dit moment weg.
    expect(calls.some((c) => c.method === "not")).toBe(false);
  });

  it("meldt één speler af zonder de rest te raken", async () => {
    await zetMijnAanwezigheid("opt-1", "g1", "p3", false);
    const upsert = calls.find((c) => c.method === "upsert");
    expect(upsert?.args[0]).toMatchObject({ player_id: "p3", aanwezig: false });
    expect(calls.some((c) => c.method === "delete")).toBe(false);
  });

  it("haalt de rij weg bij 'toch weer mee'", async () => {
    // Niet `aanwezig = true`: dan zou een latere intrekking van je ja-stem geen
    // effect meer hebben, want de handmatige keuze wint altijd.
    await zetMijnAanwezigheid("opt-1", "g1", "p3", null);
    expect(calls.some((c) => c.method === "upsert")).toBe(false);
    expect(calls.some((c) => c.method === "delete")).toBe(true);
  });

  it("invalideert de cache waar useRealtime ook op mikt", async () => {
    await zetMijnAanwezigheid("opt-1", "g1", "p3", false);
    expect(
      calls.find((c) => c.method === "invalidate")?.args,
    ).toEqual(["play-poll-presence"]);
  });
});
