import { describe, it, expect } from "vitest";
import { bekendeSpelerIds, zichtbareSpelers } from "./visibility";
import type { Friendship, Profile } from "@/types";

const ME = "me";

function profiel(id: string, discoverable?: boolean): Profile {
  return {
    id,
    username: id,
    full_name: id.toUpperCase(),
    avatar_url: null,
    created_at: "",
    ...(discoverable === undefined ? {} : { discoverable }),
  };
}

function vriendschap(
  a: string,
  b: string,
  status: Friendship["status"] = "accepted",
): Friendship {
  return {
    id: `${a}-${b}`,
    requester_id: a,
    addressee_id: b,
    status,
    created_at: "",
    updated_at: "",
  } as Friendship;
}

function groep(id: string, leden: string[]) {
  return { id, member_ids: leden } as Parameters<typeof bekendeSpelerIds>[1][0];
}

describe("bekendeSpelerIds", () => {
  it("bevat mezelf, mijn geaccepteerde vrienden en mijn groepsgenoten", () => {
    const bekend = bekendeSpelerIds(
      [vriendschap(ME, "vriend"), vriendschap("x", ME)],
      [groep("g1", ["clubgenoot", ME])],
      ME,
    );
    expect([...bekend].sort()).toEqual(["clubgenoot", "me", "vriend", "x"]);
  });

  it("telt openstaande en geweigerde verzoeken niet mee", () => {
    const bekend = bekendeSpelerIds(
      [vriendschap(ME, "wacht", "pending"), vriendschap(ME, "nee", "declined")],
      [],
      ME,
    );
    expect(bekend.has("wacht")).toBe(false);
    expect(bekend.has("nee")).toBe(false);
  });

  it("negeert vriendschappen tussen twee anderen (#326-netwerkrijen)", () => {
    // getMyFriendships() levert sinds #326 ook rijen van groepsgenoten op;
    // die maken die mensen niet tot míjn vrienden.
    const bekend = bekendeSpelerIds([vriendschap("a", "b")], [], ME);
    expect(bekend.has("a")).toBe(false);
    expect(bekend.has("b")).toBe(false);
  });
});

describe("zichtbareSpelers", () => {
  const lijst = [
    profiel("open"),
    profiel("expliciet-open", true),
    profiel("verborgen", false),
    profiel("verborgen-vriend", false),
    profiel("verborgen-opgevraagd", false),
  ];

  it("houdt verborgen spelers uit de lijst", () => {
    const namen = zichtbareSpelers(lijst, new Set()).map((p) => p.id);
    expect(namen).toEqual(["open", "expliciet-open"]);
  });

  it("laat een verborgen speler staan die ik al ken", () => {
    const namen = zichtbareSpelers(lijst, new Set(["verborgen-vriend"])).map(
      (p) => p.id,
    );
    expect(namen).toContain("verborgen-vriend");
    expect(namen).not.toContain("verborgen");
  });

  it("laat expliciet opgevraagde spelers staan", () => {
    const namen = zichtbareSpelers(lijst, new Set(), [
      "verborgen-opgevraagd",
      null,
      undefined,
    ]).map((p) => p.id);
    expect(namen).toContain("verborgen-opgevraagd");
    expect(namen).not.toContain("verborgen");
  });

  it("behandelt een ontbrekend discoverable-veld als zichtbaar", () => {
    expect(zichtbareSpelers([profiel("zonder-veld")], new Set())).toHaveLength(1);
  });
});
