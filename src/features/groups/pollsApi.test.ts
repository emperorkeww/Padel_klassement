import { describe, it, expect } from "vitest";
import { pollClub, type PlayPoll } from "./pollsApi";

// pollClub leidt het Club-object af uit de locatie-snapshot op de poll (#322),
// zodat de UI de opgeslagen club gebruikt i.p.v. de globale voorkeur.
function poll(overrides: Partial<PlayPoll> = {}): PlayPoll {
  return {
    id: "poll-1",
    group_id: "g1",
    created_by: "p1",
    status: "open",
    locked_option_id: null,
    created_at: "2026-07-08T10:00:00Z",
    locked_at: null,
    booked_at: null,
    club_id: "tenant-42",
    club_name: "Padel Gent",
    club_city: "Gent",
    club_timezone: "Europe/Brussels",
    ...overrides,
  };
}

describe("pollClub (#322)", () => {
  it("bouwt het Club-object uit de opgeslagen snapshot", () => {
    expect(pollClub(poll())).toEqual({
      id: "tenant-42",
      name: "Padel Gent",
      city: "Gent",
      timezone: "Europe/Brussels",
    });
  });

  it("vult een ontbrekende stad aan met een lege string", () => {
    expect(pollClub(poll({ club_city: null })).city).toBe("");
  });

  it("behoudt een lege club_id (handmatige locatie)", () => {
    // Een handmatige locatie heeft geen Playtomic-tenant: leeg id blijft leeg.
    expect(pollClub(poll({ club_id: "", club_name: "Sporthal" })).id).toBe("");
  });
});
