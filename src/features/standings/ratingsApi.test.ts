import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const h = await import("@/test/apiHarness");
  return { supabase: h.build() };
});

import { enqueue, reset, calls } from "@/test/apiHarness";
import { invalidateAll } from "@/lib/supabase/queryCache";
import {
  RECENT_HISTORY_LIMIT,
  getRatingHistoriesForMatches,
  getRatingsAsOf,
  getRecentRatingHistories,
  mergeRatingHistories,
} from "./ratingsApi";
import type { RatingPoint } from "@/types";

/** Eén rating_history-rij zoals de tabel/RPC hem teruggeeft. */
const rij = (player_id: string, played_at: string, rating_after: number) => ({
  player_id,
  match_id: `m-${played_at}`,
  rating_before: rating_after - 10,
  rating_after,
  delta: 10,
  played_at,
});

const punt = (match_id: string, rating_after: number): RatingPoint => ({
  match_id,
  rating_before: rating_after - 10,
  rating_after,
  delta: 10,
  played_at: `2026-07-${match_id.slice(-2)}T19:00:00Z`,
});

beforeEach(() => {
  reset();
  // De module-cache leeft buiten de test; anders deelt de volgende test het
  // antwoord van de vorige.
  invalidateAll();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getRecentRatingHistories (#731)", () => {
  it("vraagt de RPC met een venster per speler", async () => {
    enqueue({ data: [] });
    await getRecentRatingHistories();

    const rpc = calls.find((c) => c.method === "rpc");
    expect(rpc?.name).toBe("recent_rating_history");
    expect(rpc?.args).toEqual([{ p_limit: RECENT_HISTORY_LIMIT }]);
    // Niet meer de hele tabel: geen select op rating_history.
    expect(calls.some((c) => c.table === "rating_history")).toBe(false);
  });

  it("groepeert per speler, chronologisch (oud → nieuw)", async () => {
    enqueue({
      data: [
        rij("p1", "2026-07-20T19:00:00Z", 1520),
        rij("p2", "2026-07-20T19:00:00Z", 1480),
        rij("p1", "2026-07-06T19:00:00Z", 1500),
        rij("p1", "2026-07-13T19:00:00Z", 1510),
      ],
    });

    const byPlayer = await getRecentRatingHistories();

    expect(byPlayer.p1.map((p) => p.rating_after)).toEqual([1500, 1510, 1520]);
    expect(byPlayer.p2.map((p) => p.rating_after)).toEqual([1480]);
    // player_id hoort niet in de punten zelf te blijven staan.
    expect(byPlayer.p1[0]).not.toHaveProperty("player_id");
  });

  it("laat een fout doorkomen", async () => {
    enqueue({ error: new Error("boem") });
    await expect(getRecentRatingHistories()).rejects.toThrow("boem");
  });

  it("pagineert langs max_rows heen (#1241)", async () => {
    // Een volle eerste pagina betekent: er kan meer zijn — vraag door.
    const vol = Array.from({ length: 1000 }, (_, i) =>
      rij(`p${i % 40}`, `2026-07-01T${String(i % 24).padStart(2, "0")}:00:00Z`, 1000 + i),
    );
    enqueue({ data: vol }, { data: [rij("p-laatste", "2026-07-20T19:00:00Z", 1480)] });

    const byPlayer = await getRecentRatingHistories();

    const rpcs = calls.filter((c) => c.method === "rpc");
    const ranges = calls.filter((c) => c.method === "range");
    expect(rpcs).toHaveLength(2);
    expect(ranges.map((c) => c.args)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(byPlayer["p-laatste"]).toHaveLength(1);
  });
});

describe("getRatingHistoriesForMatches (#731)", () => {
  it("vraagt precies de opgegeven matches op", async () => {
    enqueue({ data: [rij("p1", "2026-07-06T19:00:00Z", 1500)] });
    const byPlayer = await getRatingHistoriesForMatches(["m2", "m1", "m1"]);

    const inCall = calls.find((c) => c.method === "in");
    // Ontdubbeld en gesorteerd, zodat dezelfde lijst dezelfde cache-sleutel geeft.
    expect(inCall?.args).toEqual(["match_id", ["m1", "m2"]]);
    expect(byPlayer.p1).toHaveLength(1);
  });

  it("doet geen query voor een lege lijst", async () => {
    expect(await getRatingHistoriesForMatches([])).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it("hakt grote lijsten in blokken", async () => {
    enqueue({ data: [] }, { data: [] });
    await getRatingHistoriesForMatches(
      Array.from({ length: 150 }, (_, i) => `m${String(i).padStart(3, "0")}`),
    );

    const chunks = calls.filter((c) => c.method === "in");
    expect(chunks).toHaveLength(2);
    expect((chunks[0].args[1] as string[]).length).toBe(100);
    expect((chunks[1].args[1] as string[]).length).toBe(50);
  });
});

describe("mergeRatingHistories (#731)", () => {
  it("voegt bronnen samen en houdt het chronologisch", () => {
    const merged = mergeRatingHistories(
      { p1: [punt("m-10", 1500)] },
      { p1: [punt("m-05", 1490)], p2: [punt("m-10", 1400)] },
    );

    expect(merged.p1.map((p) => p.match_id)).toEqual(["m-05", "m-10"]);
    expect(merged.p2).toHaveLength(1);
  });

  it("telt een punt dat in beide bronnen zit maar één keer", () => {
    const merged = mergeRatingHistories(
      { p1: [punt("m-10", 1500)] },
      { p1: [punt("m-10", 1500)] },
    );

    expect(merged.p1).toHaveLength(1);
  });
});

describe("getRatingsAsOf (#731)", () => {
  it("vraagt de server om de stand van die dag", async () => {
    enqueue({
      data: [
        { player_id: "p1", rating: 1500, played_at: "2026-07-06T19:00:00Z" },
        { player_id: "p2", rating: 1480, played_at: "2026-07-06T19:00:00Z" },
      ],
    });

    const map = await getRatingsAsOf("2026-07-10");

    const rpc = calls.find((c) => c.method === "rpc");
    expect(rpc?.name).toBe("ratings_as_of");
    expect(rpc?.args).toEqual([{ p_date: "2026-07-10" }]);
    expect(map).toEqual({ p1: 1500, p2: 1480 });
  });
});
