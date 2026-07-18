import { describe, it, expect, vi, beforeEach } from "vitest";

// Supabase-client mocken: we sturen per test wat rpc() teruggeeft.
// vi.hoisted omdat de mock-factory naar de top wordt gehesen.
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ supabase: { rpc } }));

import {
  enqueue,
  flush,
  getCount,
  saveCompletedMatch,
} from "@/features/matches/outbox";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

const completed = {
  a1: "p1",
  a2: null,
  b1: "p3",
  b2: null,
  winner: "a" as const,
  scoreA: 6,
  scoreB: 4,
  groupId: null,
  setScores: null,
  courtType: null,
};

const planned = {
  a1: "p1",
  a2: null,
  b1: "p3",
  b2: null,
  playedAt: null,
  groupId: null,
  courtType: null,
};

beforeEach(() => {
  rpc.mockReset();
  setOnline(true);
  // localStorage wordt globaal na elke test geleegd; zeker weten schoon starten.
  try {
    localStorage.clear();
  } catch {
    /* geen storage */
  }
});

describe("outbox", () => {
  it("bewaart een gequeuede schrijfactie persistent (overleeft een herstart)", () => {
    enqueue("completedMatch", { ...completed, clientToken: "t1" });
    // getCount leest telkens uit localStorage — dus ook na een 'herstart'.
    expect(getCount()).toBe(1);
  });

  it("speelt de wachtrij op volgorde af, met de idempotentie-token, en leegt hem", async () => {
    rpc.mockResolvedValue({ data: "srv-id", error: null });
    enqueue("completedMatch", { ...completed, clientToken: "t1" });
    enqueue("plannedMatch", { ...planned, clientToken: "t2" });

    const res = await flush();

    expect(res.sent).toBe(2);
    expect(getCount()).toBe(0);
    expect(rpc.mock.calls[0][0]).toBe("create_completed_match");
    expect(rpc.mock.calls[1][0]).toBe("create_planned_match");
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_client_token: "t1" });
  });

  it("een tweede flush doet niets meer (geen dubbele verzending)", async () => {
    rpc.mockResolvedValue({ data: "srv-id", error: null });
    enqueue("completedMatch", { ...completed, clientToken: "t1" });
    await flush();
    rpc.mockClear();

    const res = await flush();

    expect(res.sent).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("houdt het item in de wachtrij bij een transient (netwerk)fout", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    enqueue("completedMatch", { ...completed, clientToken: "t1" });

    const res = await flush();

    expect(res.sent).toBe(0);
    expect(res.dropped).toHaveLength(0);
    expect(getCount()).toBe(1);
  });

  it("dropt een 'poison' item bij een blijvende afwijzing en rapporteert het", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "permission denied for function", code: "42501" },
    });
    enqueue("completedMatch", { ...completed, clientToken: "t1" });

    const res = await flush();

    expect(res.sent).toBe(0);
    expect(res.dropped).toHaveLength(1);
    expect(getCount()).toBe(0);
  });

  it("flush is een no-op zonder verbinding", async () => {
    setOnline(false);
    enqueue("completedMatch", { ...completed, clientToken: "t1" });

    const res = await flush();

    expect(res.sent).toBe(0);
    expect(getCount()).toBe(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("saveCompletedMatch: online direct opslaan, niet queuen", async () => {
    rpc.mockResolvedValue({ data: "srv-id", error: null });

    const r = await saveCompletedMatch({ ...completed });

    expect(r).toEqual({ status: "saved", matchId: "srv-id" });
    expect(getCount()).toBe(0);
    expect(rpc.mock.calls[0][1]).toHaveProperty("p_client_token");
  });

  it("saveCompletedMatch: offline in de wachtrij, geen RPC-poging", async () => {
    setOnline(false);

    const r = await saveCompletedMatch({ ...completed });

    expect(r.status).toBe("queued");
    expect(getCount()).toBe(1);
    expect(rpc).not.toHaveBeenCalled();
  });
});
