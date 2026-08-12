import { describe, it, expect } from "vitest";
import {
  activePolls,
  besteOptie,
  courtsNeeded,
  diffPollOptions,
  nonVoters,
  optionState,
  pollExpired,
  pollOptions,
  tallyOption,
  vastlegbaar,
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
    date: "2026-07-10",
    start_time: "20:00",
    duration: 90,
    courts_free: 2,
    created_at: "2026-07-08T10:00:00Z",
    ...overrides,
  };
}

/** Epoch (ms) van een ISO-tijdstip; de fixtures spelen in Europe/Brussels
 *  (juli = UTC+2): optie 2026-07-10 20:00, duur 90 → verlopen om 22:00
 *  clubtijd = 2026-07-10T20:00:00Z. */
const at = (iso: string) => new Date(iso).getTime();

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

describe("besteOptie", () => {
  const today = "2026-07-08";
  /** Twee banen vrij, tenzij de optie zelf iets anders zegt. */
  const vrij = (o: PollOption) => o.courts_free;

  it("kiest het moment met de meeste ja-stemmen", () => {
    const vroeg = option({ id: "opt-1", date: "2026-07-10" });
    const laat = option({ id: "opt-2", date: "2026-07-11" });
    const stemmen = [
      vote("p1", "yes", "opt-1"),
      vote("p1", "yes", "opt-2"),
      vote("p2", "yes", "opt-2"),
    ];

    expect(besteOptie([vroeg, laat], stemmen, vrij, today)?.id).toBe("opt-2");
  });

  it("laat bij gelijkspel het vroegste moment winnen", () => {
    const vroeg = option({ id: "opt-1", date: "2026-07-10" });
    const laat = option({ id: "opt-2", date: "2026-07-11" });
    const stemmen = [vote("p1", "yes", "opt-1"), vote("p2", "yes", "opt-2")];

    expect(besteOptie([vroeg, laat], stemmen, vrij, today)?.id).toBe("opt-1");
  });

  it("slaat onhaalbare en voorbije momenten over", () => {
    const voorbij = option({ id: "opt-1", date: "2026-07-01" });
    const vol = option({ id: "opt-2", date: "2026-07-10", courts_free: 1 });
    const kan = option({ id: "opt-3", date: "2026-07-11" });
    // Vijf ja's → 2 banen nodig; opt-2 heeft er maar 1 vrij.
    const stemmen = ["p1", "p2", "p3", "p4", "p5"].flatMap((p) => [
      vote(p, "yes", "opt-1"),
      vote(p, "yes", "opt-2"),
    ]);

    expect(besteOptie([voorbij, vol, kan], stemmen, vrij, today)?.id).toBe(
      "opt-3",
    );
  });

  it("stelt niets voor als er niets vastlegbaar is", () => {
    const voorbij = option({ id: "opt-1", date: "2026-07-01" });

    expect(besteOptie([voorbij], [], vrij, today)).toBeNull();
    expect(besteOptie([], [], vrij, today)).toBeNull();
  });

  it("telt een moment op vandaag nog mee", () => {
    expect(vastlegbaar(option({ date: today }), today)).toBe(true);
    expect(vastlegbaar(option({ date: "2026-07-07" }), today)).toBe(false);
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
    expect(
      activePolls(polls, opts, at("2026-07-08T12:00:00Z")).map((p) => p.id),
    ).toEqual(["open", "booked"]);
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
    expect(
      activePolls(polls, opts, at("2026-07-08T12:00:00Z")).map((p) => p.id),
    ).toEqual(["vroeg", "laat"]);
  });

  it("laat een geboekte poll staan tot slot-einde + marge, ook tijdens het spelen", () => {
    const polls = [
      poll({ id: "booked", status: "booked", locked_option_id: "opt-b" }),
    ];
    // 20:00 + 90 min + 30 min marge → verlopen om 22:00 clubtijd (20:00Z).
    const opts = [option({ id: "opt-b", poll_id: "booked", date: "2026-07-10" })];
    const ids = (nowMs: number) =>
      activePolls(polls, opts, nowMs).map((p) => p.id);
    expect(ids(at("2026-07-10T18:30:00Z"))).toEqual(["booked"]); // tijdens het slot
    expect(ids(at("2026-07-10T19:59:00Z"))).toEqual(["booked"]); // net vóór einde + marge
    expect(ids(at("2026-07-10T20:01:00Z"))).toEqual([]); // ná einde + marge
  });

  it("laat een open poll vervallen zodra álle momenten voorbij zijn", () => {
    const polls = [poll({ id: "open", status: "open" })];
    const opts = [
      option({ id: "a", poll_id: "open", date: "2026-07-10" }),
      option({ id: "b", poll_id: "open", date: "2026-07-12" }),
    ];
    // Eerste moment voorbij, laatste nog niet: poll blijft zinvol.
    expect(
      activePolls(polls, opts, at("2026-07-11T12:00:00Z")).map((p) => p.id),
    ).toEqual(["open"]);
    // Alle momenten voorbij: weg.
    expect(activePolls(polls, opts, at("2026-07-12T20:01:00Z"))).toEqual([]);
  });

  it("laat een gelockte poll vervallen op het gekozen moment, niet op andere opties", () => {
    const polls = [
      poll({ id: "locked", status: "locked", locked_option_id: "gekozen" }),
    ];
    const opts = [
      option({ id: "gekozen", poll_id: "locked", date: "2026-07-10" }),
      option({ id: "later", poll_id: "locked", date: "2026-07-14" }),
    ];
    expect(activePolls(polls, opts, at("2026-07-10T20:01:00Z"))).toEqual([]);
  });

  it("laat een open poll zonder opties staan", () => {
    const polls = [poll({ id: "leeg", status: "open" })];
    expect(
      activePolls(polls, [], at("2026-07-10T20:01:00Z")).map((p) => p.id),
    ).toEqual(["leeg"]);
  });

  it("negeert geannuleerde polls", () => {
    expect(
      activePolls([poll({ status: "cancelled" })], [], at("2026-07-08T12:00:00Z")),
    ).toEqual([]);
  });
});

describe("pollExpired", () => {
  it("vergelijkt in clubtijd: zelfde klokmoment, andere tijdzone", () => {
    const opts = [option()];
    // 20:01Z: in Brussel (22:01) is het slot + marge voorbij…
    expect(pollExpired(poll(), opts, at("2026-07-10T20:01:00Z"))).toBe(true);
    // …maar in New York (16:01) moet 20:00 lokaal nog beginnen.
    const ny = poll({ club_timezone: "America/New_York" });
    expect(pollExpired(ny, opts, at("2026-07-10T20:01:00Z"))).toBe(false);
  });

  it("houdt een geboekte poll met onvindbare gekozen optie defensief vast", () => {
    const booked = poll({ status: "booked", locked_option_id: "weg" });
    expect(pollExpired(booked, [], at("2026-07-10T20:01:00Z"))).toBe(false);
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
