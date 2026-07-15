import { describe, it, expect } from "vitest";
import {
  focusPoll,
  lockedOptionOf,
  pollPhase,
  roundsExistFor,
} from "./planFlowLogic";
import type { PlayPoll, PollOption } from "./pollsApi";
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
    ...overrides,
  };
}

function option(overrides: Partial<PollOption> = {}): PollOption {
  return {
    id: "opt-1",
    poll_id: "poll-1",
    group_id: "g1",
    date: "2026-07-10",
    start_time: "20:00",
    duration: 90,
    courts_free: 2,
    created_at: "2026-07-08T10:00:00Z",
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
    ...overrides,
  };
}

describe("lockedOptionOf", () => {
  it("vindt het gekozen moment; null zonder lock of bij ontbrekende optie", () => {
    const opts = [option({ id: "opt-a" })];
    expect(lockedOptionOf(poll(), opts)).toBeNull();
    expect(
      lockedOptionOf(poll({ locked_option_id: "opt-a" }), opts)?.id,
    ).toBe("opt-a");
    expect(lockedOptionOf(poll({ locked_option_id: "weg" }), opts)).toBeNull();
  });
});

describe("pollPhase", () => {
  it("volgt de poll-status; 'klaar' pas als er rondes staan", () => {
    expect(pollPhase(poll({ status: "open" }), false)).toBe("stemmen");
    expect(pollPhase(poll({ status: "locked" }), false)).toBe("gekozen");
    expect(pollPhase(poll({ status: "booked" }), false)).toBe("geboekt");
    expect(pollPhase(poll({ status: "booked" }), true)).toBe("klaar");
  });
});

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

describe("focusPoll", () => {
  const today = "2026-07-10";

  it("geeft de speeldag van vandaag voorrang op een open poll", () => {
    const active = [
      poll({ id: "open-eerst", status: "open" }),
      poll({
        id: "vandaag",
        status: "booked",
        locked_option_id: "opt-vandaag",
        booked_at: "2026-07-09T08:00:00Z",
      }),
    ];
    const opts = [
      option({ id: "opt-open", poll_id: "open-eerst", date: "2026-07-12" }),
      option({ id: "opt-vandaag", poll_id: "vandaag", date: today }),
    ];
    expect(focusPoll(active, opts, today)?.id).toBe("vandaag");
  });

  it("kiest anders de eerste poll waar nog actie nodig is", () => {
    const active = [
      poll({
        id: "geboekt-vroeg",
        status: "booked",
        locked_option_id: "opt-b",
        booked_at: "2026-07-09T08:00:00Z",
      }),
      poll({ id: "open-laat", status: "open" }),
    ];
    const opts = [
      option({ id: "opt-b", poll_id: "geboekt-vroeg", date: "2026-07-12" }),
      option({ id: "opt-o", poll_id: "open-laat", date: "2026-07-15" }),
    ];
    expect(focusPoll(active, opts, today)?.id).toBe("open-laat");
  });

  it("valt terug op de eerstvolgende geboekte speeldag", () => {
    const active = [
      poll({
        id: "geboekt",
        status: "booked",
        locked_option_id: "opt-b",
        booked_at: "2026-07-09T08:00:00Z",
      }),
    ];
    const opts = [option({ id: "opt-b", poll_id: "geboekt", date: "2026-07-12" })];
    expect(focusPoll(active, opts, today)?.id).toBe("geboekt");
    expect(focusPoll([], [], today)).toBeNull();
  });
});
