import { describe, it, expect, vi } from "vitest";

// api.ts importeert de Supabase-client bij het laden; mocken zoals elders.
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: makeSupabaseMock({}) };
});

import { teamLabel } from "./api";
import { PROFILES, TEAMS } from "@/test/fixtures";
import type { Profile, Team } from "@/types";

const profiles = Object.fromEntries(
  PROFILES.map((p) => [p.id, p as Profile]),
);
const byId = Object.fromEntries(TEAMS.map((t) => [t.id, t as Team]));

describe("teamLabel", () => {
  it("toont beide namen van een dubbel", () => {
    expect(teamLabel(byId["t-ab"], profiles)).toBe("Alice Anders & Bob Boers");
  });

  it("toont bij singles (1v1) één naam — geen '&' en geen 'Onbekend'", () => {
    expect(teamLabel(byId["t-a"], profiles)).toBe("Alice Anders");
  });

  it("geeft de teamnaam voorrang en valt zonder team terug op 'Onbekend team'", () => {
    expect(teamLabel({ ...byId["t-a"], name: "De Kanonnen" }, profiles)).toBe(
      "De Kanonnen",
    );
    expect(teamLabel(undefined, profiles)).toBe("Onbekend team");
  });
});
