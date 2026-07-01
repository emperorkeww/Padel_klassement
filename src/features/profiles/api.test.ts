import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabase", async () => {
  const h = await import("../../test/apiHarness");
  return { supabase: h.build() };
});

import { enqueue, reset, calls } from "../../test/apiHarness";
import {
  displayName,
  getAllProfiles,
  getProfile,
  getProfilesMap,
  searchProfiles,
  updateProfile,
  uploadAvatar,
} from "./api";

beforeEach(() => reset());

describe("displayName", () => {
  it("valt terug op 'Onbekend' zonder profiel", () => {
    expect(displayName(null)).toBe("Onbekend");
    expect(displayName(undefined)).toBe("Onbekend");
  });

  it("gebruikt full_name, anders de username", () => {
    expect(displayName({ username: "alice", full_name: "Alice Anders" })).toBe("Alice Anders");
    expect(displayName({ username: "bob", full_name: "  " })).toBe("bob");
    expect(displayName({ username: "carol", full_name: null })).toBe("carol");
  });
});

describe("getAllProfiles", () => {
  it("geeft de rijen terug", async () => {
    enqueue({ data: [{ id: "p1" }, { id: "p2" }] });
    expect(await getAllProfiles()).toHaveLength(2);
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: { message: "stuk" } });
    await expect(getAllProfiles()).rejects.toEqual({ message: "stuk" });
  });
});

describe("getProfile", () => {
  it("geeft één profiel terug", async () => {
    enqueue({ data: { id: "p1", username: "alice" } });
    expect(await getProfile("p1")).toMatchObject({ username: "alice" });
  });
});

describe("getProfilesMap", () => {
  it("bouwt een map op id", async () => {
    enqueue({ data: [{ id: "p1" }, { id: "p2" }] });
    const map = await getProfilesMap();
    expect(Object.keys(map)).toEqual(["p1", "p2"]);
  });
});

describe("searchProfiles", () => {
  it("geeft [] terug zonder query, zonder supabase te raken", async () => {
    expect(await searchProfiles("   ", "me")).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("zoekt op username en sluit jezelf uit", async () => {
    enqueue({ data: [{ id: "p2", username: "bob" }] });
    const res = await searchProfiles("bo", "me");
    expect(res).toHaveLength(1);
    expect(calls.some((c) => c.method === "ilike")).toBe(true);
    expect(calls.some((c) => c.method === "neq")).toBe(true);
  });
});

describe("updateProfile", () => {
  it("stuurt de patch mee naar update", async () => {
    enqueue({ error: null });
    await updateProfile("p1", { full_name: "Nieuw" });
    const upd = calls.find((c) => c.method === "update");
    expect(upd?.args[0]).toEqual({ full_name: "Nieuw" });
  });
});

describe("uploadAvatar", () => {
  it("uploadt en geeft een publieke URL met cache-buster terug", async () => {
    enqueue({ error: null });
    const file = new File(["x"], "foto.PNG", { type: "image/png" });
    const url = await uploadAvatar("p1", file);
    expect(url).toContain("https://cdn.test/avatars/p1/avatar.png");
    expect(url).toMatch(/\?v=\d+/);
    const up = calls.find((c) => c.method === "upload");
    expect(up?.args[0]).toBe("p1/avatar.png");
  });
});