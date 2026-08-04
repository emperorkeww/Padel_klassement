import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const h = await import("@/test/apiHarness");
  return { supabase: h.build() };
});

import { enqueue, reset, calls } from "@/test/apiHarness";
import { invalidateAll } from "@/lib/supabase/queryCache";
import {
  mijnRelaties,
  reopenFriendRequest,
  searchDiscoverableProfiles,
} from "./api";
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
    enqueue({ error: { message: "boem" } });
    await expect(reopenFriendRequest("f5", "p1", "p6")).rejects.toBeTruthy();
    expect(calls.some((c) => c.method === "insert")).toBe(false);
  });
});

describe("searchDiscoverableProfiles", () => {
  it("geeft [] terug zonder query, zonder supabase te raken", async () => {
    expect(await searchDiscoverableProfiles("   ", "me")).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("zoekt op username en sluit jezelf uit", async () => {
    enqueue({ data: [{ id: "p2", username: "bob" }] });
    const res = await searchDiscoverableProfiles("bo", "me");
    expect(res).toHaveLength(1);
    expect(calls.some((c) => c.method === "ilike")).toBe(true);
    expect(calls.some((c) => c.method === "neq")).toBe(true);
  });

  // De kern van de privacy-belofte (#564/#1014): verborgen spelers mogen niet
  // op naam op te diepen zijn.
  it("filtert op discoverable = true", async () => {
    enqueue({ data: [] });
    await searchDiscoverableProfiles("bo", "me");
    expect(
      calls.some(
        (c) =>
          c.method === "eq" &&
          c.args[0] === "discoverable" &&
          c.args[1] === true,
      ),
    ).toBe(true);
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: { message: "stuk" } });
    await expect(searchDiscoverableProfiles("bo", "me")).rejects.toEqual({
      message: "stuk",
    });
  });
});
