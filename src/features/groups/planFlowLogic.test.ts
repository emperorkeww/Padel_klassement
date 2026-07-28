import { describe, it, expect } from "vitest";
import {
  focusPoll,
  heeftGestemd,
  lockedOptionOf,
  pollPhase,
  roundsExistFor,
  splitPolls,
} from "./planFlowLogic";
import type { PlayPoll, PollOption, PollVote } from "./pollsApi";
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
    format: "2v2",
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

describe("splitPolls", () => {
  it("scheidt vastgelegde speeldagen van polls waarop nog gestemd wordt", () => {
    const active = [
      poll({ id: "open-1", status: "open" }),
      poll({ id: "gekozen", status: "locked" }),
      poll({ id: "geboekt", status: "booked" }),
      poll({ id: "open-2", status: "open" }),
    ];
    const { vastgelegd, stemmen } = splitPolls(active);
    // Beide lijsten houden de chronologische volgorde van activePolls aan.
    expect(vastgelegd.map((p) => p.id)).toEqual(["gekozen", "geboekt"]);
    expect(stemmen.map((p) => p.id)).toEqual(["open-1", "open-2"]);
  });

  it("levert lege lijsten zonder actieve speeldagen", () => {
    expect(splitPolls([])).toEqual({ vastgelegd: [], stemmen: [] });
  });
});

describe("heeftGestemd", () => {
  const p = poll({ id: "poll-1" });
  const opts = [
    option({ id: "opt-a", poll_id: "poll-1" }),
    option({ id: "opt-b", poll_id: "poll-1" }),
    option({ id: "opt-vreemd", poll_id: "poll-2" }),
  ];
  const vote = (option_id: string, player_id: string): PollVote => ({
    option_id,
    group_id: "g1",
    player_id,
    status: "yes",
    updated_at: "2026-07-08T10:00:00Z",
  });

  it("is waar zodra er op één eigen moment gestemd is", () => {
    expect(heeftGestemd(p, opts, [vote("opt-b", "p1")], "p1")).toBe(true);
  });

  it("telt stemmen van anderen of op een andere poll niet mee", () => {
    expect(heeftGestemd(p, opts, [vote("opt-a", "p2")], "p1")).toBe(false);
    expect(heeftGestemd(p, opts, [vote("opt-vreemd", "p1")], "p1")).toBe(false);
    expect(heeftGestemd(p, opts, [], "p1")).toBe(false);
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
  // Gedeelde link (#675): ?poll=<id> zet die speeldag in focus.
  describe("gedeelde link", () => {
    const active = [
      poll({ id: "vandaag", status: "booked", locked_option_id: "opt-vandaag" }),
      poll({ id: "open", status: "open" }),
      poll({ id: "later", status: "booked", locked_option_id: "opt-later" }),
    ];
    const opts = [
      option({ id: "opt-vandaag", poll_id: "vandaag", date: today }),
      option({ id: "opt-open", poll_id: "open", date: "2026-07-12" }),
      option({ id: "opt-later", poll_id: "later", date: "2026-07-20" }),
    ];

    it("wint van de speeldag van vandaag", () => {
      // Zonder link zou "vandaag" winnen; wie op de link tikt wil "later".
      expect(focusPoll(active, opts, today)?.id).toBe("vandaag");
      expect(focusPoll(active, opts, today, "later")?.id).toBe("later");
    });

    it("kan ook een poll kiezen die actie nodig heeft", () => {
      expect(focusPoll(active, opts, today, "open")?.id).toBe("open");
    });

    it("valt stil terug als de poll niet meer actief is", () => {
      // Verlopen, geannuleerd of uit een andere groep: geen lege tab, gewoon
      // de normale keuze.
      expect(focusPoll(active, opts, today, "bestaat-niet")?.id).toBe("vandaag");
      expect(focusPoll([], [], today, "bestaat-niet")).toBeNull();
    });

    it("negeert een lege of ontbrekende parameter", () => {
      expect(focusPoll(active, opts, today, "")?.id).toBe("vandaag");
      expect(focusPoll(active, opts, today, null)?.id).toBe("vandaag");
      expect(focusPoll(active, opts, today, undefined)?.id).toBe("vandaag");
    });
  });
});
