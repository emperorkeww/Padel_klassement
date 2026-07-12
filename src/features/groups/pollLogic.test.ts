import { describe, it, expect } from "vitest";
import {
  activePolls,
  courtsNeeded,
  diffPollOptions,
  nonVoters,
  optionState,
  pollOptions,
  tallyOption,
} from "./pollLogic";
import type {
  NewPollOption,
  PlayPoll,
  PollOption,
  PollVote,
} from "./pollsApi";

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

function vote(
  playerId: string,
  status: PollVote["status"],
  optionId = "opt-1",
): PollVote {
  return {
    option_id: optionId,
    group_id: "g1",
    player_id: playerId,
    status,
    updated_at: "2026-07-08T10:00:00Z",
  };
}

describe("courtsNeeded", () => {
  it("rekent 4 spelers per baan, minimaal 1 baan", () => {
    expect(courtsNeeded(0)).toBe(1);
    expect(courtsNeeded(4)).toBe(1);
    expect(courtsNeeded(5)).toBe(2);
    expect(courtsNeeded(8)).toBe(2);
    expect(courtsNeeded(9)).toBe(3);
  });
});

describe("optionState", () => {
  it("beoordeelt haalbaarheid t.o.v. de banen-behoefte", () => {
    expect(optionState(4, null)).toBe("onbekend");
    expect(optionState(4, 2)).toBe("haalbaar"); // 1 nodig, 2 vrij
    expect(optionState(4, 1)).toBe("krap"); // 1 nodig, 1 vrij
    expect(optionState(5, 1)).toBe("onhaalbaar"); // 2 nodig, 1 vrij
    expect(optionState(0, 0)).toBe("onhaalbaar"); // niets vrij
  });
});

describe("tallyOption", () => {
  it("telt per status en negeert andere opties", () => {
    const t = tallyOption(option(), [
      vote("p1", "yes"),
      vote("p2", "yes"),
      vote("p3", "maybe"),
      vote("p4", "no"),
      vote("p5", "yes", "andere-optie"),
    ]);
    expect(t.yes).toEqual(["p1", "p2"]);
    expect(t.maybe).toEqual(["p3"]);
    expect(t.no).toEqual(["p4"]);
    expect(t.needed).toBe(1);
    expect(t.enoughPlayers).toBe(false);
  });
});

describe("activePolls", () => {
  it("toont open, gelockte én toekomstig-geboekte polls samen", () => {
    const polls = [
      poll({ id: "booked", status: "booked", locked_option_id: "opt-b" }),
      poll({ id: "open", status: "open" }),
    ];
    const opts = [
      option({ id: "opt-b", poll_id: "booked", date: "2026-07-12" }),
      option({ id: "opt-o", poll_id: "open", date: "2026-07-10" }),
    ];
    expect(activePolls(polls, opts, "2026-07-08").map((p) => p.id)).toEqual([
      "open",
      "booked",
    ]);
  });

  it("sorteert soonest-first op het eerstvolgende moment", () => {
    const polls = [
      poll({ id: "laat", status: "open" }),
      poll({ id: "vroeg", status: "open" }),
    ];
    const opts = [
      option({ id: "a", poll_id: "laat", date: "2026-07-14", start_time: "20:00" }),
      option({ id: "b", poll_id: "vroeg", date: "2026-07-10", start_time: "19:00" }),
    ];
    expect(activePolls(polls, opts, "2026-07-08").map((p) => p.id)).toEqual([
      "vroeg",
      "laat",
    ]);
  });

  it("toont een geboekte poll zolang het moment nog moet komen", () => {
    const polls = [
      poll({ id: "booked", status: "booked", locked_option_id: "opt-b" }),
    ];
    const opts = [option({ id: "opt-b", poll_id: "booked", date: "2026-07-10" })];
    expect(activePolls(polls, opts, "2026-07-08").map((p) => p.id)).toEqual([
      "booked",
    ]);
    expect(activePolls(polls, opts, "2026-07-11")).toEqual([]);
  });

  it("negeert geannuleerde polls", () => {
    expect(
      activePolls([poll({ status: "cancelled" })], [], "2026-07-08"),
    ).toEqual([]);
  });
});

describe("nonVoters", () => {
  it("vindt leden zonder enige stem op de poll", () => {
    const opts = [option({ id: "a" }), option({ id: "b" })];
    const votes = [
      vote("p1", "yes", "a"),
      vote("p2", "no", "b"),
      vote("p9", "yes", "andere-poll-optie"),
    ];
    expect(nonVoters(["p1", "p2", "p3", "p4"], opts, votes)).toEqual([
      "p3",
      "p4",
    ]);
  });
});

describe("diffPollOptions", () => {
  it("berekent toe te voegen en te verwijderen momenten; ongewijzigd blijft staan", () => {
    const existing = [
      option({ id: "keep", date: "2026-07-10", start_time: "20:00" }),
      option({ id: "drop", date: "2026-07-11", start_time: "19:00" }),
    ];
    const picked = new Map<string, NewPollOption>([
      [
        "2026-07-10|20:00",
        { date: "2026-07-10", startTime: "20:00", duration: 90, courtsFree: 2 },
      ],
      [
        "2026-07-12|21:00",
        { date: "2026-07-12", startTime: "21:00", duration: 90, courtsFree: 1 },
      ],
    ]);
    const diff = diffPollOptions(existing, picked);
    expect(diff.toRemoveIds).toEqual(["drop"]);
    expect(diff.toAdd.map((o) => `${o.date}|${o.startTime}`)).toEqual([
      "2026-07-12|21:00",
    ]);
  });
});

describe("pollOptions", () => {
  it("sorteert de opties van de poll op datum + tijd", () => {
    const opts = [
      option({ id: "b", date: "2026-07-11", start_time: "19:00" }),
      option({ id: "c", date: "2026-07-10", start_time: "21:00" }),
      option({ id: "a", date: "2026-07-10", start_time: "19:30" }),
      option({ id: "x", poll_id: "andere-poll" }),
    ];
    expect(pollOptions(poll(), opts).map((o) => o.id)).toEqual(["a", "c", "b"]);
  });
});
