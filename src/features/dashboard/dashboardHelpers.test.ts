import { describe, it, expect } from "vitest";
import {
  HERO_THEMA_PRIORITEIT,
  heroCrestTekst,
  heroThema,
  pickPollBanner,
} from "./dashboardHelpers";
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
  });
});

describe("heroThema (#644/#760)", () => {
  const geen = {
    dictator: false,
    bigDaddy: false,
    kampioen: false,
    inForm: false,
    onFire: false,
    pias: false,
    piet: false,
    schild: false,
  };

  it("laat de hero neutraal zonder enige status", () => {
    expect(heroThema(geen)).toBeNull();
  });

  it("geeft elke status zijn eigen thema", () => {
    expect(heroThema({ ...geen, dictator: true })).toBe("dictator");
    expect(heroThema({ ...geen, bigDaddy: true })).toBe("bigdaddy");
    expect(heroThema({ ...geen, kampioen: true })).toBe("kampioen");
    expect(heroThema({ ...geen, inForm: true })).toBe("inform");
    expect(heroThema({ ...geen, onFire: true })).toBe("onfire");
    expect(heroThema({ ...geen, pias: true })).toBe("pias");
    expect(heroThema({ ...geen, piet: true })).toBe("piet");
  });

  it("spiegelt de volgorde van EDITIE_PRIORITEIT op de FUT-kaart", () => {
    // De hele ladder in één keer: bij álles tegelijk wint de troon, en met elke
    // hogere status uitgeschakeld schuift precies de volgende naar voren.
    expect(HERO_THEMA_PRIORITEIT).toEqual([
      "dictator",
      "bigdaddy",
      "kampioen",
      "inform",
      "onfire",
      "pias",
      "piet",
    ]);
    const alles = {
      dictator: true,
      bigDaddy: true,
      kampioen: true,
      inForm: true,
      onFire: true,
      pias: true,
      piet: true,
      schild: false,
    };
    expect(heroThema(alles)).toBe("dictator");
    expect(heroThema({ ...alles, dictator: false })).toBe("bigdaddy");
    expect(heroThema({ ...alles, dictator: false, bigDaddy: false })).toBe(
      "kampioen",
    );
    expect(
      heroThema({ ...alles, dictator: false, bigDaddy: false, kampioen: false }),
    ).toBe("inform");
    expect(
      heroThema({
        ...alles,
        dictator: false,
        bigDaddy: false,
        kampioen: false,
        inForm: false,
      }),
    ).toBe("onfire");
    expect(heroThema({ ...geen, pias: true, piet: true })).toBe("pias");
  });

  it("laat verdienste de schande verdringen, net als op de FUT-kaart", () => {
    // Andere assen: het klassement kent geen groepen, de schande-tokens wel.
    // Wie tegelijk #1 en schande-drager is, krijgt het thema van de eer — de
    // schande-crest blijft ernaast staan (Dashboard.tsx).
    expect(heroThema({ ...geen, bigDaddy: true, piet: true })).toBe("bigdaddy");
    expect(heroThema({ ...geen, bigDaddy: true, pias: true })).toBe("bigdaddy");
    expect(heroThema({ ...geen, dictator: true, pias: true, piet: true })).toBe(
      "dictator",
    );
    // Ook de drie nieuwe eer-statussen verdringen de schande (#760).
    expect(heroThema({ ...geen, kampioen: true, pias: true })).toBe("kampioen");
    expect(heroThema({ ...geen, inForm: true, pias: true })).toBe("inform");
    expect(heroThema({ ...geen, onFire: true, pias: true })).toBe("onfire");
    expect(heroThema({ ...geen, onFire: true, piet: true })).toBe("onfire");
  });

  it("laat binnen de eer de zeldzaamste titel voorgaan", () => {
    // Kroon boven kwartaaltitel, kwartaaltitel boven weeklens, weeklens boven
    // de reeks — On-Fire is de enige met meerdere dragers tegelijk (#632) en
    // staat daarom achteraan.
    expect(heroThema({ ...geen, bigDaddy: true, inForm: true })).toBe("bigdaddy");
    expect(heroThema({ ...geen, kampioen: true, onFire: true })).toBe("kampioen");
    expect(heroThema({ ...geen, inForm: true, onFire: true })).toBe("inform");
  });

  it("laat binnen de schande de weeklens winnen van het rondgaande token", () => {
    expect(heroThema({ ...geen, pias: true, piet: true })).toBe("pias");
  });

  it("dooft met een roast-schild alleen de schande-thema's", () => {
    expect(heroThema({ ...geen, pias: true, schild: true })).toBeNull();
    expect(heroThema({ ...geen, piet: true, schild: true })).toBeNull();
    expect(heroThema({ ...geen, pias: true, piet: true, schild: true })).toBeNull();
    // Eer valt niet onder het schild: daar valt niets te beschermen.
    expect(heroThema({ ...geen, bigDaddy: true, schild: true })).toBe("bigdaddy");
    expect(heroThema({ ...geen, dictator: true, schild: true })).toBe("dictator");
    expect(heroThema({ ...geen, kampioen: true, schild: true })).toBe("kampioen");
    expect(heroThema({ ...geen, inForm: true, schild: true })).toBe("inform");
    expect(heroThema({ ...geen, onFire: true, schild: true })).toBe("onfire");
    // Met schild valt de hero terug op de hoogste eer-status, niet op neutraal.
    expect(
      heroThema({ ...geen, kampioen: true, pias: true, schild: true }),
    ).toBe("kampioen");
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
