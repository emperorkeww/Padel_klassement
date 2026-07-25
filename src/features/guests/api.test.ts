import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const h = await import("@/test/apiHarness");
  return { supabase: h.build() };
});

import { enqueue, reset, calls } from "@/test/apiHarness";
import { cached, invalidateAll } from "@/lib/supabase/queryCache";
import {
  getMyGuestClaims,
  requestGuestClaim,
  claimGuestPlayer,
  cancelGuestClaim,
} from "./api";

beforeEach(() => {
  reset();
  invalidateAll();
});

describe("getMyGuestClaims", () => {
  it("haalt alleen openstaande verzoeken op", async () => {
    enqueue({ data: [{ id: "gc1", guest_id: "g1", player_id: "p1" }] });
    const list = await getMyGuestClaims();
    expect(list).toHaveLength(1);
    expect(calls).toContainEqual({
      table: "guest_claims",
      method: "eq",
      args: ["status", "pending"],
    });
  });
});

describe("requestGuestClaim", () => {
  it("roept de RPC aan met gast en speler en geeft de verzoek-id terug", async () => {
    enqueue({ data: "gc1" });
    await expect(requestGuestClaim("g1", "p2")).resolves.toBe("gc1");
    expect(calls).toContainEqual({
      method: "rpc",
      name: "request_guest_claim",
      args: [{ p_guest_id: "g1", p_player_id: "p2" }],
    });
  });

  it("gooit de fout van de RPC door (bv. een botsing)", async () => {
    enqueue({ error: { message: "gast en speler in dezelfde match" } });
    await expect(requestGuestClaim("g1", "p2")).rejects.toBeTruthy();
  });
});

describe("claimGuestPlayer", () => {
  it("geeft de samenvatting terug", async () => {
    enqueue({ data: { matches: 3, groepen: 1 } });
    await expect(claimGuestPlayer("g1", "p1")).resolves.toEqual({
      matches: 3,
      groepen: 1,
    });
    expect(calls).toContainEqual({
      method: "rpc",
      name: "claim_guest_player",
      args: [{ p_guest_id: "g1", p_player_id: "p1" }],
    });
  });

  it("wist de gecachte lijsten die door de merge verouderd raken", async () => {
    // De gast verdwijnt en zijn matches hangen aan andere teams: profielen,
    // matches en standen mogen niet uit de cache blijven komen.
    const verse = vi.fn().mockResolvedValue("vers");
    await cached("profiles:all", () => Promise.resolve("oud"));
    await cached("standings:all", () => Promise.resolve("oud"));

    enqueue({ data: { matches: 1, groepen: 0 } });
    await claimGuestPlayer("g1", "p1");

    await expect(cached("profiles:all", verse)).resolves.toBe("vers");
    await expect(cached("standings:all", verse)).resolves.toBe("vers");
  });
});

describe("cancelGuestClaim", () => {
  it("roept de RPC aan met de verzoek-id", async () => {
    enqueue({ data: null });
    await cancelGuestClaim("gc1");
    expect(calls).toContainEqual({
      method: "rpc",
      name: "cancel_guest_claim",
      args: [{ p_claim_id: "gc1" }],
    });
  });
});
