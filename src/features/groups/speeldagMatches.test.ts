import { describe, it, expect } from "vitest";
import {
  matchesVoorSpeeldag,
  momentenOpDag,
  speeldagMoment,
} from "./speeldagMatches";
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
  // De speeldag van 20:00 op 16 juli; hij is in elke test hetzelfde.
  const avond = speeldagMoment(poll(), [option()])!;

  it("neemt de matches met een starttijd op die dag", () => {
    const list = [
      match({ id: "wel", played_at: "2026-07-16T18:00:00Z" }), // 20:00 clubtijd
      match({ id: "niet", played_at: "2026-07-17T18:00:00Z" }),
    ];
    expect(matchesVoorSpeeldag(list, avond).map((m) => m.id)).toEqual(["wel"]);
  });

  it("valt zonder starttijd terug op created_at", () => {
    const list = [
      match({ id: "wel", played_at: null, created_at: "2026-07-16T09:00:00Z" }),
      match({ id: "niet", played_at: null, created_at: "2026-07-15T09:00:00Z" }),
    ];
    expect(matchesVoorSpeeldag(list, avond).map((m) => m.id)).toEqual(["wel"]);
  });

  it("rekent in clubtijd, niet in UTC", () => {
    // 23:00 UTC op de 16e is 01:00 clubtijd op de 17e: die valt buiten de dag,
    // ook al zegt de UTC-datum de 16e.
    const list = [
      match({ id: "avond", played_at: "2026-07-16T18:30:00Z" }),
      match({ id: "nacht-eruit", played_at: "2026-07-16T23:00:00Z" }),
    ];
    expect(matchesVoorSpeeldag(list, avond).map((m) => m.id)).toEqual(["avond"]);
  });

  it("laat een partij van ver vóór het slot buiten de speeldag (#1221)", () => {
    // 12:00 UTC is 14:00 clubtijd, zes uur voor een speeldag van 20:00. Dat is
    // een losse partij op dezelfde dag, geen wedstrijd van die avond. Vlak
    // ervoor beginnen mag wel: je kunt eerder op de baan staan dan geboekt.
    const list = [
      match({ id: "middag", played_at: "2026-07-16T12:00:00Z" }),
      match({ id: "net-ervoor", played_at: "2026-07-16T17:30:00Z" }), // 19:30
    ];
    expect(matchesVoorSpeeldag(list, avond).map((m) => m.id)).toEqual([
      "net-ervoor",
    ]);
  });

  it("rekent de nacht ná de avond ervoor niet mee (#1221)", () => {
    // 22:30 UTC op de 15e is 00:30 clubtijd op de 16e. `dayInZone` zet die op
    // de 16e, maar het is de staart van de avond dáárvoor — niet iets van de
    // speeldag die pas negentien uur later begint.
    const list = [match({ id: "nacht", played_at: "2026-07-15T22:30:00Z" })];
    expect(matchesVoorSpeeldag(list, avond)).toEqual([]);
  });

  it("telt een losse partij op dezelfde dag gewoon mee", () => {
    const list = [
      match({ id: "ronde", round_number: 3, played_at: "2026-07-16T18:00:00Z" }),
      match({ id: "los", round_number: null, played_at: "2026-07-16T20:00:00Z" }),
    ];
    expect(matchesVoorSpeeldag(list, avond).map((m) => m.id)).toEqual([
      "ronde",
      "los",
    ]);
  });
});

// Een groep kan er twee op één datum hebben: een ochtendsessie en een
// avondsessie. Tot #1146 deelden die dezelfde lijst, dus toonde elke pagina
// ook de wedstrijden van de andere.
describe("twee speeldagen op één dag (#1146)", () => {
  const ochtendOptie = option({ id: "opt-ochtend", start_time: "10:00" });
  const avondOptie = option({ id: "opt-avond", start_time: "20:00" });
  const ochtendPoll = poll({ id: "poll-ochtend", locked_option_id: "opt-ochtend" });
  const avondPoll = poll({ id: "poll-avond", locked_option_id: "opt-avond" });

  const ochtend = speeldagMoment(ochtendPoll, [ochtendOptie])!;
  const avond = speeldagMoment(avondPoll, [avondOptie])!;

  // 16 juli 2026, clubtijd Europe/Brussels (UTC+2).
  const list = [
    match({ id: "ochtend-1", played_at: "2026-07-16T08:00:00Z" }), // 10:00
    match({ id: "ochtend-2", played_at: "2026-07-16T08:40:00Z" }), // 10:40
    match({ id: "avond-1", played_at: "2026-07-16T18:00:00Z" }), // 20:00
    match({ id: "avond-2", played_at: "2026-07-16T18:20:00Z" }), // 20:20
  ];

  it("geeft elk moment zijn eigen wedstrijden", () => {
    expect(matchesVoorSpeeldag(list, ochtend, [avond]).map((m) => m.id)).toEqual([
      "ochtend-1",
      "ochtend-2",
    ]);
    expect(matchesVoorSpeeldag(list, avond, [ochtend]).map((m) => m.id)).toEqual([
      "avond-1",
      "avond-2",
    ]);
  });

  // De uitloop hoort bij de sessie waar hij uit voortkomt, niet bij de klok:
  // een ronde die om 11:30 nog loopt ligt dichter bij 10:00 dan bij 20:00.
  it("rekent op afstand tot het moment, niet op een vast venster", () => {
    const uitloop = [match({ id: "uitloop", played_at: "2026-07-16T09:30:00Z" })];
    expect(
      matchesVoorSpeeldag(uitloop, ochtend, [avond]).map((m) => m.id),
    ).toEqual(["uitloop"]);
    expect(matchesVoorSpeeldag(uitloop, avond, [ochtend])).toEqual([]);
  });

  it("houdt zonder buren alles van die sessie vast", () => {
    // Zonder tweede sessie is er niets om tegen af te wegen, dus claimt de
    // ochtend alles van die dag vanaf zijn eigen begin — de avondwedstrijden
    // incluis. De ochtendwedstrijden liggen andersom uren vóór de avondsessie
    // en horen daar sinds #1221 niet meer bij, ook niet zonder buur.
    expect(matchesVoorSpeeldag(list, ochtend).map((m) => m.id)).toEqual(
      list.map((m) => m.id),
    );
    expect(matchesVoorSpeeldag(list, avond).map((m) => m.id)).toEqual([
      "avond-1",
      "avond-2",
    ]);
  });

  it("vindt de momenten van een dag op tijd gesorteerd", () => {
    const momenten = momentenOpDag(
      [avondPoll, ochtendPoll, poll({ id: "poll-open", status: "open" })],
      [avondOptie, ochtendOptie],
      "2026-07-16",
    );
    expect(momenten.map((m) => m.option.start_time)).toEqual(["10:00", "20:00"]);
  });
});
