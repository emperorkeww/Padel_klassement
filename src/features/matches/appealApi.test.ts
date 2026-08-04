import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const h = await import("@/test/apiHarness");
  return { supabase: h.build() };
});

import { enqueue, reset, calls } from "@/test/apiHarness";
import {
  castAppealVote,
  createAppeal,
  getMatchAppeals,
  getOpenAppeals,
} from "./appealApi";

beforeEach(() => reset());

describe("getMatchAppeals", () => {
  it("haalt de beroepen van één match op, nieuwste eerst", async () => {
    enqueue({ data: [{ id: "a1", match_id: "m1" }] });
    const rijen = await getMatchAppeals("m1");
    expect(rijen).toHaveLength(1);
    expect(calls.find((c) => c.method === "eq")?.args).toEqual([
      "match_id",
      "m1",
    ]);
    expect(calls.find((c) => c.method === "order")?.args[0]).toBe("created_at");
  });
});

describe("getOpenAppeals", () => {
  it("vraagt alleen de openstaande zaken; RLS doet de rest", async () => {
    enqueue({ data: [] });
    await getOpenAppeals();
    expect(calls.find((c) => c.method === "eq")?.args).toEqual([
      "status",
      "open",
    ]);
  });
});

describe("createAppeal", () => {
  it("stuurt alleen de kolommen die de client mag zetten", async () => {
    enqueue({ data: null });
    await createAppeal({
      matchId: "m1",
      claimantId: "p3",
      reden: "ons-punt",
      setNumber: 2,
      toelichting: "  die bal was binnen  ",
    });
    const rij = calls.find((c) => c.method === "insert")?.args[0] as Record<
      string,
      unknown
    >;
    expect(rij).toEqual({
      match_id: "m1",
      claimant_id: "p3",
      reden: "ons-punt",
      set_number: 2,
      // Getrimd, en nooit de serverside kolommen (snapshot, speeldag, venster).
      toelichting: "die bal was binnen",
    });
  });

  it("maakt van een lege toelichting null", async () => {
    enqueue({ data: null });
    await createAppeal({
      matchId: "m1",
      claimantId: "p3",
      reden: "buiten",
      toelichting: "   ",
    });
    const rij = calls.find((c) => c.method === "insert")?.args[0] as Record<
      string,
      unknown
    >;
    expect(rij.toelichting).toBeNull();
    expect(rij.set_number).toBeNull();
  });

  it("gooit de fout door zodat de UI hem kan vertalen", async () => {
    enqueue({ error: { code: "23505", message: "duplicate key value" } });
    await expect(
      createAppeal({ matchId: "m1", claimantId: "p3", reden: "net" }),
    ).rejects.toMatchObject({ code: "23505" });
  });
});

describe("castAppealVote", () => {
  it("legt de stem vast met naam", async () => {
    enqueue({ data: null });
    await castAppealVote({ appealId: "a1", voterId: "p1", akkoord: true });
    expect(calls.find((c) => c.method === "insert")?.args[0]).toEqual({
      appeal_id: "a1",
      voter_id: "p1",
      akkoord: true,
    });
  });

  it("gooit een geweigerde stem door", async () => {
    enqueue({ error: { message: "de stemming is gesloten" } });
    await expect(
      castAppealVote({ appealId: "a1", voterId: "p1", akkoord: false }),
    ).rejects.toMatchObject({ message: "de stemming is gesloten" });
  });
});
