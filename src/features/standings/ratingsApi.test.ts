import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const h = await import("@/test/apiHarness");
  return { supabase: h.build() };
});

import { enqueue, reset, calls } from "@/test/apiHarness";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { MAX_ROWS } from "@/lib/supabase/truncation";
import { getAllRatingHistories } from "./ratingsApi";

/** Eén rating_history-rij zoals de tabel hem teruggeeft. */
const rij = (player_id: string, played_at: string, rating_after: number) => ({
  player_id,
  match_id: `m-${played_at}`,
  rating_before: rating_after - 10,
  rating_after,
  delta: 10,
  played_at,
});

beforeEach(() => {
  reset();
  // De module-cache leeft buiten de test; anders deelt test 2 het antwoord van 1.
  invalidateAll();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getAllRatingHistories (#731)", () => {
  it("haalt nieuwste eerst op met een expliciete limiet", async () => {
    enqueue({ data: [] });
    await getAllRatingHistories();

    const order = calls.find((c) => c.method === "order");
    expect(order?.args).toEqual(["played_at", { ascending: false }]);
    // Zonder limiet kapt PostgREST stil af op max_rows; expliciet is beter.
    const limit = calls.find((c) => c.method === "limit");
    expect(limit?.args).toEqual([MAX_ROWS]);
  });

  it("geeft per speler chronologisch terug (oud → nieuw)", async () => {
    enqueue({
      data: [
        rij("p1", "2026-07-20T19:00:00Z", 1520),
        rij("p2", "2026-07-20T19:00:00Z", 1480),
        rij("p1", "2026-07-13T19:00:00Z", 1510),
        rij("p1", "2026-07-06T19:00:00Z", 1500),
      ],
    });

    const byPlayer = await getAllRatingHistories();

    expect(byPlayer.p1.map((p) => p.rating_after)).toEqual([1500, 1510, 1520]);
    expect(byPlayer.p2.map((p) => p.rating_after)).toEqual([1480]);
    // player_id hoort niet in de punten zelf te blijven staan.
    expect(byPlayer.p1[0]).not.toHaveProperty("player_id");
  });

  it("waarschuwt zodra het resultaat op de limiet uitkomt", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    enqueue({
      data: Array.from({ length: MAX_ROWS }, (_, i) =>
        rij("p1", `2026-07-${String((i % 28) + 1).padStart(2, "0")}T19:00:00Z`, 1500 + i),
      ),
    });

    await getAllRatingHistories();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("rating_history");
  });

  it("laat een fout doorkomen", async () => {
    enqueue({ error: new Error("boem") });
    await expect(getAllRatingHistories()).rejects.toThrow("boem");
  });
});
