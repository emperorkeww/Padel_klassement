import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const h = await import("@/test/apiHarness");
  return { supabase: h.build() };
});

import { reset, calls } from "@/test/apiHarness";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { mijnRelaties, reopenFriendRequest } from "./api";
import type { Friendship } from "@/types";

beforeEach(() => {
  reset();
  invalidateAll();
});

const rij = (
  id: string,
  requester_id: string,
  addressee_id: string,
  status: Friendship["status"],
): Friendship =>
  ({ id, requester_id, addressee_id, status }) as Friendship;

describe("mijnRelaties", () => {
  const MIJ = "p1";

  it("negeert vriendschappen tussen twee anderen (#1013)", () => {
    // Sinds #326 leest de feed ook rijen die niet over mij gaan; die maakten
    // vreemden onterecht "al gekoppeld".
    const map = mijnRelaties([rij("f1", "p4", "p6", "accepted")], MIJ);
    expect(map.size).toBe(0);
    expect(map.has("p4")).toBe(false);
    expect(map.has("p6")).toBe(false);
  });

  it("sleutelt op de andere speler, in beide richtingen", () => {
    const map = mijnRelaties(
      [
        rij("f1", MIJ, "p2", "accepted"),
        rij("f2", "p3", MIJ, "accepted"),
        rij("f3", MIJ, "p4", "pending"),
        rij("f4", "p5", MIJ, "pending"),
      ],
      MIJ,
    );
    expect(map.get("p2")?.soort).toBe("vrienden");
    expect(map.get("p3")?.soort).toBe("vrienden");
    expect(map.get("p4")?.soort).toBe("verzoek-verstuurd");
    expect(map.get("p5")?.soort).toBe("verzoek-ontvangen");
    expect(map.has(MIJ)).toBe(false);
  });

  it("houdt uit elkaar wie geweigerd heeft", () => {
    const map = mijnRelaties(
      [rij("f1", MIJ, "p2", "declined"), rij("f2", "p3", MIJ, "declined")],
      MIJ,
    );
    expect(map.get("p2")?.soort).toBe("geweigerd-door-hen");
    expect(map.get("p3")?.soort).toBe("geweigerd-door-mij");
    // De rij komt mee, zodat de UI hem kan heropruimen.
    expect(map.get("p3")?.rij.id).toBe("f2");
  });
});

describe("reopenFriendRequest", () => {
  it("verwijdert de oude rij en stuurt een vers verzoek", async () => {
    // Niet een update naar 'pending': de UPDATE-policy hoort bij de addressee
    // en friendships_unique_pair laat geen tweede rij per paar toe.
    await reopenFriendRequest("f5", "p1", "p6");

    const opFriendships = calls.filter((c) => c.table === "friendships");
    expect(opFriendships.map((c) => c.method)).toEqual(
      expect.arrayContaining(["delete", "eq", "insert"]),
    );
    expect(opFriendships).toContainEqual({
      table: "friendships",
      method: "eq",
      args: ["id", "f5"],
    });
    expect(opFriendships).toContainEqual({
      table: "friendships",
      method: "insert",
      args: [{ requester_id: "p1", addressee_id: "p6" }],
    });
    // Verwijderen gaat vóór het nieuwe verzoek, anders botst de unique index.
    const volgorde = opFriendships.map((c) => c.method);
    expect(volgorde.indexOf("delete")).toBeLessThan(volgorde.indexOf("insert"));
  });

  it("stuurt geen verzoek als het verwijderen faalt", async () => {
    const { enqueue } = await import("@/test/apiHarness");
    enqueue({ error: { message: "boem" } });
    await expect(reopenFriendRequest("f5", "p1", "p6")).rejects.toBeTruthy();
    expect(calls.some((c) => c.method === "insert")).toBe(false);
  });
});
