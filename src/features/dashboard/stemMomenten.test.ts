import { describe, it, expect } from "vitest";
import { kiesStemMomenten } from "./stemMomenten";
import type { OpenPollBundle } from "./dashboardHelpers";
import type { GroupSummary } from "@/features/groups/api";
import type {
  PlayPoll,
  PollOption,
  PollVote,
  PollVoteStatus,
} from "@/features/groups/pollsApi";

// De kiezer achter de stemkaart op het overzicht (#1196). De banner die hier
// stond koos op groepsvolgorde; hier gaat het om tijd, en om de vraag welke
// momenten er nog toe doen.

/** 12:00 in Brussel (CEST), 14:00 in Kiev, 06:00 in New York. */
const NU = new Date("2026-08-12T10:00:00Z").getTime();
const UUR = 3600_000;

function groep(id: string, name: string): GroupSummary {
  return { id, name } as unknown as GroupSummary;
}

function poll(overrides: Partial<PlayPoll> = {}): PlayPoll {
  return {
    id: "poll-1",
    group_id: "g1",
    created_by: "p1",
    status: "open",
    locked_option_id: null,
    created_at: "2026-08-01T10:00:00Z",
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

function optie(overrides: Partial<PollOption> = {}): PollOption {
  return {
    id: "opt-1",
    poll_id: "poll-1",
    group_id: "g1",
    date: "2026-08-13",
    start_time: "20:00",
    duration: 90,
    courts_free: 2,
    created_at: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

function stem(
  option_id: string,
  player_id: string,
  status: PollVoteStatus,
): PollVote {
  return {
    option_id,
    group_id: "g1",
    player_id,
    status,
    updated_at: "2026-08-11T10:00:00Z",
  };
}

/** Eén groep met één poll en zijn momenten. */
function bundel(
  group: GroupSummary,
  polls: PlayPoll[],
  options: PollOption[],
  votes: PollVote[] = [],
): OpenPollBundle {
  return { group, polls, options, votes };
}

describe("kiesStemMomenten", () => {
  it("zet de eerstvolgende momenten vooraan, over groepen heen", () => {
    // De tweede groep speelt eerder. De banner koos op groepsvolgorde en zou
    // hier de speeldag van volgende week tonen.
    const data = kiesStemMomenten(
      [
        bundel(
          groep("g1", "Vrijdagpadel"),
          [poll({ id: "p-laat" })],
          [optie({ id: "o-laat", poll_id: "p-laat", date: "2026-08-20" })],
        ),
        bundel(
          groep("g2", "Dinsdagclub"),
          [poll({ id: "p-vroeg", group_id: "g2" })],
          [
            optie({
              id: "o-vroeg",
              poll_id: "p-vroeg",
              group_id: "g2",
              date: "2026-08-13",
            }),
          ],
        ),
      ],
      "p1",
      NU,
    );

    expect(data?.momenten.map((m) => m.optionId)).toEqual([
      "o-vroeg",
      "o-laat",
    ]);
    expect(data?.meerdereGroepen).toBe(true);
    expect(data?.pollId).toBeNull();
  });

  it("laat een moment vallen zodra het slot voorbij is", () => {
    // De poll leeft nog — er komt een moment achteraan — maar op het eerste
    // valt niets meer te stemmen. pollExpired kijkt naar de hele poll en zou
    // beide laten staan.
    const data = kiesStemMomenten(
      [
        bundel(
          groep("g1", "Vrijdagpadel"),
          [poll()],
          [
            optie({ id: "o-geweest", date: "2026-08-12", start_time: "08:00" }),
            optie({ id: "o-straks", date: "2026-08-12", start_time: "20:00" }),
          ],
        ),
      ],
      "p1",
      NU,
    );

    expect(data?.momenten.map((m) => m.optionId)).toEqual(["o-straks"]);
  });

  it("houdt een moment dat nog loopt overeind", () => {
    // Slot van 11:30 tot 13:00 Brussel, het is 12:00: je kunt nog zeggen dat
    // je komt.
    const data = kiesStemMomenten(
      [
        bundel(
          groep("g1", "Vrijdagpadel"),
          [poll()],
          [optie({ id: "o-nu", date: "2026-08-12", start_time: "11:30" })],
        ),
      ],
      "p1",
      NU,
    );

    expect(data?.momenten.map((m) => m.optionId)).toEqual(["o-nu"]);
  });

  it("rekent per club in zijn eigen tijdzone", () => {
    // Twee keer "20:00" op dezelfde dag, maar New York ligt zes uur later.
    // Op de kloktijd alleen zou de volgorde toevallig zijn.
    const data = kiesStemMomenten(
      [
        bundel(
          groep("g1", "New York"),
          [poll({ id: "p-ny", club_timezone: "America/New_York" })],
          [optie({ id: "o-ny", poll_id: "p-ny", date: "2026-08-13" })],
        ),
        bundel(
          groep("g2", "Beveren"),
          [poll({ id: "p-bxl", group_id: "g2" })],
          [
            optie({
              id: "o-bxl",
              poll_id: "p-bxl",
              group_id: "g2",
              date: "2026-08-13",
            }),
          ],
        ),
      ],
      "p1",
      NU,
    );

    expect(data?.momenten.map((m) => m.optionId)).toEqual(["o-bxl", "o-ny"]);
  });

  it("laat één poll de kaart niet volledig vullen zolang een andere wacht", () => {
    const veelMomenten = ["14", "15", "16"].map((dag) =>
      optie({ id: `o-${dag}`, date: `2026-08-${dag}` }),
    );
    const data = kiesStemMomenten(
      [
        bundel(groep("g1", "Vrijdagpadel"), [poll()], veelMomenten),
        bundel(
          groep("g2", "Dinsdagclub"),
          [poll({ id: "p-ander", group_id: "g2" })],
          [
            optie({
              id: "o-ander",
              poll_id: "p-ander",
              group_id: "g2",
              date: "2026-08-19",
            }),
          ],
        ),
      ],
      "p1",
      NU,
    );

    // De twee vroegste van de volle poll, plus het moment van de andere groep
    // — en niet drie keer dezelfde poll.
    expect(data?.momenten.map((m) => m.optionId)).toEqual([
      "o-14",
      "o-15",
      "o-ander",
    ]);
  });

  it("vult wél aan uit dezelfde poll als er niets anders wacht", () => {
    const data = kiesStemMomenten(
      [
        bundel(
          groep("g1", "Vrijdagpadel"),
          [poll()],
          ["14", "15", "16", "17"].map((dag) =>
            optie({ id: `o-${dag}`, date: `2026-08-${dag}` }),
          ),
        ),
      ],
      "p1",
      NU,
    );

    expect(data?.momenten.map((m) => m.optionId)).toEqual([
      "o-14",
      "o-15",
      "o-16",
    ]);
    expect(data?.meerdereGroepen).toBe(false);
    expect(data?.pollId).toBe("poll-1");
  });

  it("telt de ja-stemmen en kent mijn eigen keuze", () => {
    const data = kiesStemMomenten(
      [
        bundel(
          groep("g1", "Vrijdagpadel"),
          [poll()],
          [optie({ id: "o-1" }), optie({ id: "o-2", date: "2026-08-14" })],
          [
            stem("o-1", "p1", "maybe"),
            stem("o-1", "p2", "yes"),
            stem("o-1", "p3", "yes"),
            stem("o-1", "p4", "no"),
            stem("o-2", "p2", "yes"),
          ],
        ),
      ],
      "p1",
      NU,
    );

    expect(data?.momenten[0]).toMatchObject({
      optionId: "o-1",
      jaAantal: 2,
      mijnStem: "maybe",
    });
    expect(data?.momenten[1]).toMatchObject({ jaAantal: 1, mijnStem: null });
    expect(data?.alGestemd).toBe(false);
  });

  it("meldt alGestemd zodra elk getoond moment jouw stem draagt", () => {
    const data = kiesStemMomenten(
      [
        bundel(
          groep("g1", "Vrijdagpadel"),
          [poll()],
          [optie({ id: "o-1" }), optie({ id: "o-2", date: "2026-08-14" })],
          [stem("o-1", "p1", "yes"), stem("o-2", "p1", "no")],
        ),
      ],
      "p1",
      NU,
    );

    expect(data?.alGestemd).toBe(true);
  });

  it("geeft de sluitingstijd pas als het eerste moment binnen een dag ligt", () => {
    const straks = kiesStemMomenten(
      [
        bundel(
          groep("g1", "Vrijdagpadel"),
          [poll()],
          [optie({ id: "o-vanavond", date: "2026-08-12", start_time: "20:00" })],
        ),
      ],
      "p1",
      NU,
    );
    // 20:00 Brussel is 18:00Z; de auto-lock ligt twaalf uur daarvoor.
    expect(straks?.sluitMs).toBe(
      new Date("2026-08-12T18:00:00Z").getTime() - 12 * UUR,
    );

    const verder = kiesStemMomenten(
      [
        bundel(
          groep("g1", "Vrijdagpadel"),
          [poll()],
          [optie({ id: "o-later", date: "2026-08-15" })],
        ),
      ],
      "p1",
      NU,
    );
    expect(verder?.sluitMs).toBeNull();
  });

  it("negeert vastgelegde, geboekte en geannuleerde polls", () => {
    const data = kiesStemMomenten(
      [
        bundel(
          groep("g1", "Vrijdagpadel"),
          [
            poll({ id: "p-vast", status: "locked", locked_option_id: "o-vast" }),
            poll({ id: "p-af", status: "cancelled" }),
          ],
          [
            optie({ id: "o-vast", poll_id: "p-vast" }),
            optie({ id: "o-af", poll_id: "p-af", date: "2026-08-14" }),
          ],
        ),
      ],
      "p1",
      NU,
    );

    expect(data).toBeNull();
  });

  it("geeft niets terug zonder groepen of zonder momenten", () => {
    expect(kiesStemMomenten([], "p1", NU)).toBeNull();
    expect(
      kiesStemMomenten(
        [bundel(groep("g1", "Vrijdagpadel"), [poll()], [])],
        "p1",
        NU,
      ),
    ).toBeNull();
  });
});
