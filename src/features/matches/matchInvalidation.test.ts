// Regressietest voor #603: een uitslag moet ook de pias- en shame-cache
// invalideren, anders blijven de pias-wissel en Zwarte-Piet-overname op de
// invoerende client stale tot de cache-TTL verloopt en verschijnen ze niet in
// de feed. invalidateMatchData() moet in de pas lopen met
// CACHE_PREFIXES.matches in useRealtime.ts.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const h = await import("@/test/apiHarness");
  return { supabase: h.build() };
});

// Alleen invalidate spionneren; de rest van de cache (o.a. cached) echt laten.
vi.mock("@/lib/supabase/queryCache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/queryCache")>();
  return { ...actual, invalidate: vi.fn() };
});

import { enqueue, reset } from "@/test/apiHarness";
import { invalidate } from "@/lib/supabase/queryCache";
import {
  createCompletedMatch,
  createPlannedMatch,
  setMatchResult,
  updateMatchScore,
  deleteMatch,
} from "./api";

const invalidateMock = vi.mocked(invalidate);

/** Alle prefixen uit één aaneengesloten invalidate-aanroep. */
function allInvalidatedPrefixes(): string[] {
  return invalidateMock.mock.calls.flat();
}

beforeEach(() => {
  reset();
  invalidateMock.mockClear();
});

describe("uitslag invalideert pias- en shame-cache (#603)", () => {
  it("createCompletedMatch bust pias en shame mee", async () => {
    enqueue({ data: "match-1" });
    await createCompletedMatch({
      a1: "p1",
      a2: "p2",
      b1: "p3",
      b2: "p4",
      winner: "a",
    });
    const prefixes = allInvalidatedPrefixes();
    expect(prefixes).toContain("pias");
    expect(prefixes).toContain("shame");
    // De bestaande match-invalidatie moet blijven werken.
    expect(prefixes).toContain("matches");
    expect(prefixes).toContain("standings");
  });

  it("setMatchResult bust pias en shame mee op de happy path", async () => {
    enqueue({ data: [{ id: "match-1" }] });
    await setMatchResult({ matchId: "match-1", winnerTeamId: "t-ab" });
    const prefixes = allInvalidatedPrefixes();
    expect(prefixes).toContain("pias");
    expect(prefixes).toContain("shame");
  });

  it("updateMatchScore (correctie) bust pias en shame mee", async () => {
    enqueue({ data: [{ id: "match-1" }] });
    await updateMatchScore({
      matchId: "match-1",
      winnerTeamId: "t-ab",
      scoreA: 6,
      scoreB: 3,
    });
    const prefixes = allInvalidatedPrefixes();
    expect(prefixes).toContain("pias");
    expect(prefixes).toContain("shame");
  });

  it("createPlannedMatch en deleteMatch bust pias en shame mee", async () => {
    enqueue({ data: "match-2" });
    await createPlannedMatch({ a1: "p1", a2: "p2", b1: "p3", b2: "p4" });
    expect(allInvalidatedPrefixes()).toEqual(
      expect.arrayContaining(["pias", "shame"]),
    );

    invalidateMock.mockClear();
    enqueue({ data: null });
    await deleteMatch("match-2");
    expect(allInvalidatedPrefixes()).toEqual(
      expect.arrayContaining(["pias", "shame"]),
    );
  });
});
