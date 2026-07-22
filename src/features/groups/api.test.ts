import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const h = await import("@/test/apiHarness");
  return { supabase: h.build() };
});

import { enqueue, reset, calls } from "@/test/apiHarness";
import {
  addGroupMember,
  addGroupMembers,
  createFairRound,
  createGroup,
  createGroupInvite,
  generateMexicanoRound,
  leaveGroup,
  redeemGroupInvite,
  removeGroupMember,
  type FairCourt,
} from "./api";

beforeEach(() => reset());

describe("createFairRound", () => {
  const courts: FairCourt[] = [
    { teamA: ["a1", "a2"], teamB: ["b1", "b2"] },
    { teamA: ["c1", "c2"], teamB: ["d1", "d2"] },
  ];

  it("slaat de spelers plat en roept create_fair_round aan, en geeft de ids terug", async () => {
    enqueue({ data: ["m1", "m2"] });
    const res = await createFairRound("g1", courts);
    expect(res).toEqual(["m1", "m2"]);
    expect(calls).toContainEqual({
      method: "rpc",
      name: "create_fair_round",
      args: [
        {
          p_group_id: "g1",
          p_players: ["a1", "a2", "b1", "b2", "c1", "c2", "d1", "d2"],
        },
      ],
    });
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: new Error("kapot") });
    await expect(createFairRound("g1", courts)).rejects.toThrow("kapot");
  });
});

describe("generateMexicanoRound", () => {
  it("roept generate_mexicano_round aan en geeft de ids terug", async () => {
    enqueue({ data: ["m3", "m4"] });
    const res = await generateMexicanoRound("g1");
    expect(res).toEqual(["m3", "m4"]);
    expect(calls).toContainEqual({
      method: "rpc",
      name: "generate_mexicano_round",
      args: [{ p_group_id: "g1" }],
    });
  });

  it("gooit als de vorige ronde nog niet af is", async () => {
    enqueue({ error: new Error("vorige ronde niet af") });
    await expect(generateMexicanoRound("g1")).rejects.toThrow("vorige ronde niet af");
  });
});

describe("createGroup", () => {
  it("insert op groups met getrimde naam en geeft de group terug", async () => {
    enqueue({ data: { id: "g1", name: "Vrijdagavond" } });
    const res = await createGroup("  Vrijdagavond  ", "u1");
    expect(res).toEqual({ id: "g1", name: "Vrijdagavond" });
    expect(calls).toContainEqual({
      table: "groups",
      method: "insert",
      args: [{ name: "Vrijdagavond", created_by: "u1" }],
    });
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: new Error("kapot") });
    await expect(createGroup("Naam", "u1")).rejects.toThrow("kapot");
  });
});

describe("addGroupMember", () => {
  it("insert op group_members", async () => {
    enqueue({ error: null });
    await addGroupMember("g1", "p1");
    expect(calls).toContainEqual({
      table: "group_members",
      method: "insert",
      args: [{ group_id: "g1", player_id: "p1" }],
    });
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: new Error("kapot") });
    await expect(addGroupMember("g1", "p1")).rejects.toThrow("kapot");
  });
});

describe("addGroupMembers", () => {
  it("keert vroeg terug bij een lege lijst zonder supabase te raken", async () => {
    await addGroupMembers("g1", []);
    expect(calls.length).toBe(0);
  });

  it("insert op group_members met alle spelers", async () => {
    enqueue({ error: null });
    await addGroupMembers("g1", ["p1", "p2"]);
    expect(calls).toContainEqual({
      table: "group_members",
      method: "insert",
      args: [
        [
          { group_id: "g1", player_id: "p1" },
          { group_id: "g1", player_id: "p2" },
        ],
      ],
    });
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: new Error("kapot") });
    await expect(addGroupMembers("g1", ["p1"])).rejects.toThrow("kapot");
  });
});

describe("removeGroupMember", () => {
  it("delete op group_members met twee eq-filters", async () => {
    enqueue({ error: null });
    await removeGroupMember("g1", "p1");
    expect(calls).toContainEqual({ table: "group_members", method: "delete", args: [] });
    expect(calls).toContainEqual({ table: "group_members", method: "eq", args: ["group_id", "g1"] });
    expect(calls).toContainEqual({ table: "group_members", method: "eq", args: ["player_id", "p1"] });
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: new Error("kapot") });
    await expect(removeGroupMember("g1", "p1")).rejects.toThrow("kapot");
  });
});

describe("leaveGroup", () => {
  it("delete op group_members met twee eq-filters", async () => {
    enqueue({ error: null });
    await leaveGroup("g1", "p1");
    expect(calls).toContainEqual({ table: "group_members", method: "delete", args: [] });
    expect(calls).toContainEqual({ table: "group_members", method: "eq", args: ["group_id", "g1"] });
    expect(calls).toContainEqual({ table: "group_members", method: "eq", args: ["player_id", "p1"] });
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: new Error("kapot") });
    await expect(leaveGroup("g1", "p1")).rejects.toThrow("kapot");
  });
});

describe("createGroupInvite", () => {
  it("roept create_group_invite aan en geeft het token terug", async () => {
    enqueue({ data: "tok-123" });
    const res = await createGroupInvite("g1");
    expect(res).toBe("tok-123");
    expect(calls).toContainEqual({
      method: "rpc",
      name: "create_group_invite",
      args: [{ p_group_id: "g1" }],
    });
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: new Error("kapot") });
    await expect(createGroupInvite("g1")).rejects.toThrow("kapot");
  });
});

describe("redeemGroupInvite", () => {
  it("roept redeem_group_invite aan en geeft het group-id terug", async () => {
    enqueue({ data: "g1" });
    const res = await redeemGroupInvite("tok-123");
    expect(res).toBe("g1");
    expect(calls).toContainEqual({
      method: "rpc",
      name: "redeem_group_invite",
      args: [{ p_token: "tok-123" }],
    });
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: new Error("kapot") });
    await expect(redeemGroupInvite("tok-123")).rejects.toThrow("kapot");
  });
});
