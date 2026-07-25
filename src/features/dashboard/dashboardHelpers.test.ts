import { describe, it, expect } from "vitest";
import { pickPollBanner } from "./dashboardHelpers";
import type { GroupSummary } from "@/features/groups/api";
import type { PlayPoll, PollOption, PollVote } from "@/features/groups/pollsApi";

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
});
