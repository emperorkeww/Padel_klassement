import { describe, it, expect } from "vitest";
import { deriveEvening, heroCrestTekst, pickPollBanner } from "./dashboardHelpers";
import { clubEpoch, dateInZone } from "@/lib/utils/time";
import type { GroupSummary } from "@/features/groups/api";
import type { PlayPoll, PollOption, PollVote } from "@/features/groups/pollsApi";
import type { Match } from "@/types";

function group(id = "g1"): GroupSummary {
  return { id, name: `Groep ${id}` } as unknown as GroupSummary;
}

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

/** Epoch (ms) van een ISO-tijdstip; fixtures in Europe/Brussels (juli =
 *  UTC+2): optie 2026-07-10 20:00, duur 90 → verlopen om 20:00Z. */
const at = (iso: string) => new Date(iso).getTime();

const noVotes: PollVote[] = [];

function vote(overrides: Partial<PollVote> = {}): PollVote {
  return {
    option_id: "opt-1",
    group_id: "g1",
    player_id: "p1",
    status: "yes",
    updated_at: "2026-07-08T10:00:00Z",
    ...overrides,
  };
}

describe("pickPollBanner", () => {
  it("prijst een lopende open poll aan zolang er een moment te spelen valt", () => {
    const rows = [
      { group: group(), polls: [poll()], options: [option()], votes: noVotes },
    ];
    const pick = pickPollBanner(rows, "p1", at("2026-07-09T12:00:00Z"));
    expect(pick?.kind).toBe("open");
  });

  // #886: zonder poll-id linkte "Stem nu →" naar de tab, waarna je bij drie
  // lopende speeldagen zelf mocht raden welke de banner bedoelde.
  it("draagt de poll-id mee zodat de banner naar díé speeldag kan linken", () => {
    const open = [
      {
        group: group(),
        polls: [poll({ id: "poll-open" })],
        options: [option({ poll_id: "poll-open" })],
        votes: noVotes,
      },
    ];
    expect(pickPollBanner(open, "p1", at("2026-07-09T12:00:00Z"))).toMatchObject(
      { kind: "open", pollId: "poll-open" },
    );

    const geboekt = [
      {
        group: group(),
        polls: [
          poll({ id: "poll-geboekt", status: "booked", locked_option_id: "opt-1" }),
        ],
        options: [option({ poll_id: "poll-geboekt" })],
        votes: [vote()],
      },
    ];
    expect(
      pickPollBanner(geboekt, "p1", at("2026-07-09T12:00:00Z")),
    ).toMatchObject({ kind: "fixed", pollId: "poll-geboekt" });
  });

  it("slaat een verlopen open poll over en valt door naar een geldig geboekt moment", () => {
    const rows = [
      {
        group: group(),
        polls: [
          poll({ id: "oud", status: "open" }),
          poll({ id: "geboekt", status: "booked", locked_option_id: "opt-b" }),
        ],
        options: [
          option({ id: "opt-oud", poll_id: "oud", date: "2026-07-10" }),
          option({ id: "opt-b", poll_id: "geboekt", date: "2026-07-14" }),
        ],
        votes: [vote({ option_id: "opt-b" })],
      },
    ];
    // 2026-07-10 20:00 + 90 min + 30 min marge is voorbij → open poll telt niet meer.
    const pick = pickPollBanner(rows, "p1", at("2026-07-11T12:00:00Z"));
    expect(pick).toEqual(
      expect.objectContaining({ kind: "fixed", booked: true, date: "2026-07-14" }),
    );
  });

  it("toont geen banner voor een geboekt moment waarvan het slot voorbij is", () => {
    const rows = [
      {
        group: group(),
        polls: [poll({ status: "booked", locked_option_id: "opt-1" })],
        options: [option()],
        votes: [vote({ option_id: "opt-1" })],
      },
    ];
    expect(pickPollBanner(rows, "p1", at("2026-07-10T19:59:00Z"))?.kind).toBe(
      "fixed", // net vóór slot-einde + marge nog wel
    );
    expect(pickPollBanner(rows, "p1", at("2026-07-10T20:01:00Z"))).toBeNull();
  });

  const fixedRows = (votes: PollVote[]) => [
    {
      group: group(),
      polls: [poll({ status: "booked", locked_option_id: "opt-1" })],
      options: [option()],
      votes,
    },
  ];

  it("toont de vastgelegde banner aan wie zich als 'kan' (yes) zette", () => {
    const pick = pickPollBanner(
      fixedRows([vote({ status: "yes" })]),
      "p1",
      at("2026-07-10T12:00:00Z"),
    );
    expect(pick?.kind).toBe("fixed");
  });

  it("verbergt de banner voor wie 'nee' of 'misschien' stemde", () => {
    for (const status of ["no", "maybe"] as const) {
      expect(
        pickPollBanner(
          fixedRows([vote({ status })]),
          "p1",
          at("2026-07-10T12:00:00Z"),
        ),
      ).toBeNull();
    }
  });

  it("verbergt de banner voor wie helemaal niet stemde", () => {
    expect(
      pickPollBanner(fixedRows(noVotes), "p1", at("2026-07-10T12:00:00Z")),
    ).toBeNull();
  });
  // Toegangscode op het overzicht (#675): alleen op de speeldag zelf, en alleen
  // als de baan ook echt geboekt is. Daarbuiten is het ruis op een dashboard.
  describe("toegangscode (#675)", () => {
    const metCode = (overrides: Partial<PlayPoll> = {}) => [
      {
        group: group(),
        polls: [
          poll({
            status: "booked",
            locked_option_id: "opt-1",
            access_code: "1234",
            ...overrides,
          }),
        ],
        options: [option()],
        votes: [vote({ status: "yes" })],
      },
    ];

    it("toont de code op de speeldag zelf", () => {
      const pick = pickPollBanner(metCode(), "p1", at("2026-07-10T12:00:00Z"));
      expect(pick).toMatchObject({ kind: "fixed", accessCode: "1234" });
    });

    it("zwijgt de dag ervoor", () => {
      const pick = pickPollBanner(metCode(), "p1", at("2026-07-09T12:00:00Z"));
      expect(pick).toMatchObject({ kind: "fixed", accessCode: null });
    });

    it("rekent de dag in clubtijd, niet in UTC", () => {
      // 2026-07-09 23:30 UTC = 2026-07-10 01:30 in Brussel: de speeldag is
      // daar al begonnen, dus de code hoort er te staan.
      const pick = pickPollBanner(metCode(), "p1", at("2026-07-09T23:30:00Z"));
      expect(pick).toMatchObject({ accessCode: "1234" });
    });

    it("zwijgt zolang de baan nog niet geboekt is", () => {
      const pick = pickPollBanner(
        metCode({ status: "locked" }),
        "p1",
        at("2026-07-10T12:00:00Z"),
      );
      expect(pick).toMatchObject({ booked: false, accessCode: null });
    });

    it("geeft null zonder code", () => {
      const pick = pickPollBanner(
        metCode({ access_code: null }),
        "p1",
        at("2026-07-10T12:00:00Z"),
      );
      expect(pick).toMatchObject({ accessCode: null });
    });

    // Banen (#802) volgen exact dezelfde regel als de code: op de speeldag
    // zelf, en alleen als er ook echt geboekt is.
    it("toont de banen op de speeldag zelf, maar niet de dag ervoor", () => {
      const rows = metCode({ courts: "3 & 4" });
      expect(pickPollBanner(rows, "p1", at("2026-07-10T12:00:00Z"))).toMatchObject(
        { courts: "3 & 4" },
      );
      expect(pickPollBanner(rows, "p1", at("2026-07-09T12:00:00Z"))).toMatchObject(
        { courts: null },
      );
    });

    it("zwijgt over de banen zolang er niet geboekt is", () => {
      const pick = pickPollBanner(
        metCode({ courts: "3 & 4", status: "locked" }),
        "p1",
        at("2026-07-10T12:00:00Z"),
      );
      expect(pick).toMatchObject({ booked: false, courts: null });
    });
  });
});

function match(over: Partial<Match>): Match {
  return {
    id: "m",
    team_a_id: "ta",
    team_b_id: "tb",
    status: "completed",
    winner_team_id: "ta",
    score_a: 6,
    score_b: 3,
    played_at: "2026-07-14T18:00:00Z",
    created_at: "2026-07-14T18:00:00Z",
    created_by: null,
    group_id: "g1",
    round_number: null,
    format: "2v2",
    ...over,
  };
}

describe("deriveEvening (#783)", () => {
  it("telt een match van net ná lokale middernacht nog als 'vandaag'", () => {
    // 00:30 lokale tijd in Europe/Brussels valt in UTC vaak nog op de
    // vorige kalenderdag (zomertijd: 2 uur eerder) — toch is het lokaal
    // vandaag.
    const today = dateInZone("Europe/Brussels");
    const iso = new Date(
      clubEpoch(today, "00:30", "Europe/Brussels"),
    ).toISOString();
    const evening = deriveEvening(
      [match({ played_at: iso, created_at: iso })],
      "Europe/Brussels",
    );
    expect(evening).toMatchObject({ groupId: "g1", count: 1, isToday: true, day: today });
  });
});

describe("heroCrestTekst (#760)", () => {
  it("splitst een editie-regel in icoon en label", () => {
    // Exact de regels die editieLabel (edities.ts) oplevert.
    expect(heroCrestTekst("⚡ In-Form · +48")).toEqual({
      emoji: "⚡",
      label: "In-Form · +48",
    });
    expect(heroCrestTekst("🔥 On Fire · 6 op rij")).toEqual({
      emoji: "🔥",
      label: "On Fire · 6 op rij",
    });
    expect(heroCrestTekst("🏆 Kampioen ☀️ Zomer 2026")).toEqual({
      emoji: "🏆",
      label: "Kampioen ☀️ Zomer 2026",
    });
  });

  it("laat geen lege chip achter bij een regel zonder ruimte", () => {
    expect(heroCrestTekst("🏆")).toEqual({ emoji: "🏆", label: "🏆" });
    expect(heroCrestTekst("")).toEqual({ emoji: "", label: "" });
  });
});
