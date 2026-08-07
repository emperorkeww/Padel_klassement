import { describe, it, expect } from "vitest";
import { matchesVoorSpeeldag, speeldagMoment } from "./speeldagMatches";
import type { PlayPoll, PollOption } from "./pollsApi";
import type { Match } from "@/types";

function poll(overrides: Partial<PlayPoll> = {}): PlayPoll {
  return {
    id: "poll-1",
    group_id: "g1",
    created_by: "p1",
    status: "booked",
    locked_option_id: "opt-1",
    created_at: "2026-07-08T10:00:00Z",
    locked_at: "2026-07-08T11:00:00Z",
    booked_at: "2026-07-08T12:00:00Z",
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

function option(overrides: Partial<PollOption> = {}): PollOption {
  return {
    id: "opt-1",
    poll_id: "poll-1",
    group_id: "g1",
    date: "2026-07-16",
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
    format: "2v2",
    ...overrides,
  };
}

describe("speeldagMoment", () => {
  it("geeft de vastgelegde optie met dag en clubtijdzone", () => {
    expect(speeldagMoment(poll(), [option()])).toEqual({
      dag: "2026-07-16",
      option: option(),
      tz: "Europe/Brussels",
    });
  });

  it("werkt ook zolang de baan nog niet geboekt is", () => {
    expect(speeldagMoment(poll({ status: "locked" }), [option()])?.dag).toBe(
      "2026-07-16",
    );
  });

  it("geeft niets bij een open of geannuleerde speeldag", () => {
    expect(
      speeldagMoment(poll({ status: "open", locked_option_id: null }), [
        option(),
      ]),
    ).toBeNull();
    expect(speeldagMoment(poll({ status: "cancelled" }), [option()])).toBeNull();
  });

  it("geeft niets als de vastgelegde optie er niet bij zit", () => {
    expect(speeldagMoment(poll(), [option({ id: "andere" })])).toBeNull();
  });
});

describe("matchesVoorSpeeldag", () => {
  const dag = "2026-07-16";
  const tz = "Europe/Brussels";

  it("neemt de matches met een starttijd op die dag", () => {
    const list = [
      match({ id: "wel", played_at: "2026-07-16T18:00:00Z" }), // 20:00 clubtijd
      match({ id: "niet", played_at: "2026-07-17T18:00:00Z" }),
    ];
    expect(matchesVoorSpeeldag(list, dag, tz).map((m) => m.id)).toEqual(["wel"]);
  });

  it("valt zonder starttijd terug op created_at", () => {
    const list = [
      match({ id: "wel", played_at: null, created_at: "2026-07-16T09:00:00Z" }),
      match({ id: "niet", played_at: null, created_at: "2026-07-15T09:00:00Z" }),
    ];
    expect(matchesVoorSpeeldag(list, dag, tz).map((m) => m.id)).toEqual(["wel"]);
  });

  it("rekent in clubtijd, niet in UTC", () => {
    // 22:30 UTC op de 15e is 00:30 clubtijd op de 16e — die hoort er dus bij,
    // en 23:00 UTC op de 16e valt al in de nacht van de 17e.
    const list = [
      match({ id: "nacht-erin", played_at: "2026-07-15T22:30:00Z" }),
      match({ id: "nacht-eruit", played_at: "2026-07-16T23:00:00Z" }),
    ];
    expect(matchesVoorSpeeldag(list, dag, tz).map((m) => m.id)).toEqual([
      "nacht-erin",
    ]);
  });

  it("telt een losse partij op dezelfde dag gewoon mee", () => {
    const list = [
      match({ id: "ronde", round_number: 3, played_at: "2026-07-16T18:00:00Z" }),
      match({ id: "los", round_number: null, played_at: "2026-07-16T20:00:00Z" }),
    ];
    expect(matchesVoorSpeeldag(list, dag, tz).map((m) => m.id)).toEqual([
      "ronde",
      "los",
    ]);
  });
});
