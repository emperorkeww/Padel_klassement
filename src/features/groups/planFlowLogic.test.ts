import { describe, it, expect } from "vitest";
import { roundsExistFor, roundsMadeFor } from "./planFlowLogic";
import type { PlayPoll } from "./pollsApi";
import type { Match } from "@/types";

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
    club_id: "91d8d419-3736-498e-90be-362de786d588",
    club_name: "LAGO CLUB Padel Beveren",
    club_city: "Beveren",
    club_timezone: "Europe/Brussels",
    access_code: null,
    courts: null,
    rounds_generated_at: null,
    ...overrides,
  };
}

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    team_a_id: "ta",
    team_b_id: "tb",
    status: "scheduled",
    winner_team_id: null,
    played_at: null,
    created_by: "p1",
    created_at: "2026-07-09T10:00:00Z",
    group_id: "g1",
    round_number: 1,
    score_a: null,
    score_b: null,
    format: "2v2",
    ...overrides,
  };
}

describe("roundsExistFor", () => {
  const booked = poll({
    status: "booked",
    booked_at: "2026-07-09T08:00:00Z",
  });

  it("telt rondes die ná het boeken zijn aangemaakt", () => {
    expect(
      roundsExistFor(booked, [match({ created_at: "2026-07-09T10:00:00Z" })]),
    ).toBe(true);
  });

  it("negeert rondes van vóór het boeken", () => {
    expect(
      roundsExistFor(booked, [match({ created_at: "2026-07-08T10:00:00Z" })]),
    ).toBe(false);
  });

  it("negeert losse wedstrijden zonder rondenummer", () => {
    expect(roundsExistFor(booked, [match({ round_number: null })])).toBe(false);
    expect(roundsExistFor(booked, [match({ round_number: 0 })])).toBe(false);
  });

  it("is false voor niet-geboekte polls of zonder booked_at", () => {
    expect(roundsExistFor(poll({ status: "locked" }), [match()])).toBe(false);
    expect(
      roundsExistFor(poll({ status: "booked", booked_at: null }), [match()]),
    ).toBe(false);
  });
});

describe("roundsMadeFor", () => {
  const booked = poll({
    status: "booked",
    booked_at: "2026-07-09T08:00:00Z",
  });

  it("telt unieke rondes, niet de matches erin", () => {
    expect(
      roundsMadeFor(booked, [
        match({ id: "m1", round_number: 3 }),
        match({ id: "m2", round_number: 3 }),
        match({ id: "m3", round_number: 4 }),
      ]),
    ).toBe(2);
  });

  it("negeert rondes van vóór het boeken en losse matches", () => {
    expect(
      roundsMadeFor(booked, [
        match({ created_at: "2026-07-08T10:00:00Z", round_number: 2 }),
        match({ round_number: null }),
      ]),
    ).toBe(0);
  });

  it("is nul zolang de speeldag niet geboekt is", () => {
    expect(roundsMadeFor(poll({ status: "locked" }), [match()])).toBe(0);
  });
});
