import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted: de mock-factory wordt naar de top van het bestand gehesen en
// moet dus vóór de gewone const-initialisatie bij deze rijen kunnen.
const ROWS = vi.hoisted(() => [
  {
    tenant_id: "t-thuis",
    date: "2026-07-02",
    payload: [{ resource_id: "court-1", start_date: "2026-07-02", slots: [] }],
    fetched_at: "2026-07-02T10:00:00.000Z",
  },
  {
    tenant_id: "t-thuis",
    date: "2026-07-03",
    payload: [],
    fetched_at: "2026-07-02T10:00:05.000Z",
  },
]);

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  return {
    supabase: makeSupabaseMock({
      tables: { court_availability_snapshots: ROWS },
    }),
  };
});

import { supabase } from "@/lib/supabase/client";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { getSnapshot, getSnapshots } from "./snapshotApi";

// Losse typering rond de gemockte client, zoals Dashboard.test.tsx dat doet:
// het echte from() is te strak getypeerd voor makeQuery-stubs.
const fromMock = supabase.from as unknown as {
  mockClear: () => void;
  mockReturnValueOnce: (value: unknown) => void;
  mockImplementationOnce: (impl: () => unknown) => void;
  mock: { calls: unknown[][] };
};

beforeEach(() => {
  // De querycache is module-breed; leegmaken zodat tests elkaar niet zien.
  invalidateAll();
  fromMock.mockClear();
});

describe("getSnapshot", () => {
  it("levert payload + fetched_at van de rij", async () => {
    const snapshot = await getSnapshot("t-thuis", "2026-07-02");

    expect(snapshot).toEqual({
      payload: ROWS[0].payload,
      fetchedAt: "2026-07-02T10:00:00.000Z",
    });
  });

  it("deelt de promise binnen de cache-TTL (één query)", async () => {
    await getSnapshot("t-thuis", "2026-07-02");
    await getSnapshot("t-thuis", "2026-07-02");

    expect(fromMock.mock.calls).toHaveLength(1);
  });

  it("DB-fout → null, nooit een exception (live pad neemt het over)", async () => {
    const { makeQuery } = await import("@/test/supabaseMock");
    fromMock.mockReturnValueOnce(
      makeQuery({ data: null, error: { message: "kapot" } }),
    );

    await expect(getSnapshot("t-thuis", "2026-07-04")).resolves.toBeNull();
  });

  it("onverwachte throw → null", async () => {
    fromMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    await expect(getSnapshot("t-thuis", "2026-07-05")).resolves.toBeNull();
  });
});

describe("getSnapshots", () => {
  it("levert een map datum → snapshot", async () => {
    const map = await getSnapshots("t-thuis", "2026-07-02", 7);

    expect(map.size).toBe(2);
    expect(map.get("2026-07-03")).toEqual({
      payload: [],
      fetchedAt: "2026-07-02T10:00:05.000Z",
    });
  });

  it("DB-fout → lege map, nooit een exception", async () => {
    const { makeQuery } = await import("@/test/supabaseMock");
    fromMock.mockReturnValueOnce(
      makeQuery({ data: null, error: { message: "kapot" } }),
    );

    const map = await getSnapshots("t-thuis", "2026-08-01", 7);
    expect(map.size).toBe(0);
  });
});
