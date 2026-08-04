import { describe, it, expect } from "vitest";
import {
  JOKERS,
  effectFactor,
  jokerBlokkade,
  jokerBlokkadeUitleg,
  jokerFactor,
  jokerFoutMelding,
  jokerGestart,
  jokerIcoon,
  jokerKaartRegel,
  jokerLabel,
  jokerPreset,
  jokerSwing,
  jokerVooraf,
  maandBezetDoor,
  maandLabel,
  periodeMaand,
  zichtbareJokers,
  type MatchJoker,
} from "@/features/matches/jokers";
import { MIN_GAMES, type MatchStake } from "@/features/matches/stakes";
import type { Match, Team } from "@/types";

const OVER_2_DAGEN = new Date(Date.now() + 2 * 86400_000).toISOString();

function match(over: Partial<Match> = {}): Match {
  return {
    id: "m1",
    team_a_id: "t-ab",
    team_b_id: "t-cd",
    status: "scheduled",
    winner_team_id: null,
    score_a: null,
    score_b: null,
    played_at: OVER_2_DAGEN,
    created_at: OVER_2_DAGEN,
    created_by: "p1",
    group_id: "g1",
    round_number: null,
    format: "2v2",
    ...over,
  } as Match;
}

function joker(over: Partial<MatchJoker> = {}): MatchJoker {
  return {
    match_id: "m1",
    player_id: "p1",
    group_id: "g1",
    joker: "schild",
    period_month: periodeMaand(OVER_2_DAGEN),
    created_at: OVER_2_DAGEN,
    ...over,
  };
}

function stake(over: Partial<MatchStake> = {}): MatchStake {
  return {
    match_id: "m1",
    player_id: "p1",
    group_id: "g1",
    play_date: "2026-09-10",
    created_at: OVER_2_DAGEN,
    ...over,
  };
}

const TEAMS: Record<string, Team> = {
  "t-ab": { id: "t-ab", player1_id: "p1", player2_id: "p2" } as Team,
  "t-cd": { id: "t-cd", player1_id: "p3", player2_id: "p4" } as Team,
};
const naam = (id: string) => id.toUpperCase();

describe("de preset", () => {
  it("kent precies de drie kaarten uit het enum", () => {
    expect(JOKERS.map((j) => j.id)).toEqual([
      "schild",
      "dubbel_of_niets",
      "wissel_van_kant",
    ]);
  });

  it("weet welke kaarten de rating raken", () => {
    expect(jokerPreset("schild")?.raaktRating).toBe(true);
    expect(jokerPreset("dubbel_of_niets")?.raaktRating).toBe(true);
    expect(jokerPreset("wissel_van_kant")?.raaktRating).toBe(false);
  });

  it("valt bij een onbekende waarde terug op de waarde zelf, zonder icoon", () => {
    expect(jokerLabel("tijdmachine")).toBe("tijdmachine");
    expect(jokerIcoon("tijdmachine")).toBe("");
    expect(jokerPreset(null)).toBeNull();
  });
});

describe("de factor (spiegel van _effect_factor)", () => {
  it("zet het schild op nul, in beide richtingen", () => {
    expect(jokerFactor("schild", true)).toBe(0);
    expect(jokerFactor("schild", false)).toBe(0);
  });

  it("verdubbelt met dubbel of niets, maar niet bij gelijkspel", () => {
    expect(jokerFactor("dubbel_of_niets", true)).toBe(2);
    expect(jokerFactor("dubbel_of_niets", false)).toBe(1);
  });

  it("laat de sociale kaart en geen kaart op één", () => {
    expect(jokerFactor("wissel_van_kant", true)).toBe(1);
    expect(jokerFactor(null, true)).toBe(1);
  });

  it("stapelt lef-tip en joker niet: nooit meer dan ×2", () => {
    expect(
      effectFactor({ joker: "dubbel_of_niets", staked: true, hasWinner: true }),
    ).toBe(2);
  });

  it("laat het schild van alles winnen, ook van een lef-tip", () => {
    expect(
      effectFactor({ joker: "schild", staked: true, hasWinner: true }),
    ).toBe(0);
  });

  it("houdt de lef-tip overeind naast een sociale kaart", () => {
    expect(
      effectFactor({ joker: "wissel_van_kant", staked: true, hasWinner: true }),
    ).toBe(2);
  });
});

describe("wat er op het spel staat", () => {
  it("verdubbelt beide kanten even hard", () => {
    const dubbel = jokerSwing(0.5, "dubbel_of_niets");
    const normaal = jokerSwing(0.5, null);
    expect(dubbel.winst).toBe(normaal.winst * 2);
    expect(dubbel.verlies).toBe(normaal.verlies * 2);
  });

  it("zet met een schild allebei de kanten op nul", () => {
    expect(jokerSwing(0.3, "schild")).toEqual({ winst: 0, verlies: -0 });
  });
});

describe("de maand die het tegoed draagt", () => {
  it("is de eerste van de maand van de match, in clubtijd", () => {
    expect(periodeMaand("2026-09-10T18:00:00.000Z")).toBe("2026-09-01");
  });

  it("volgt de clubtijdzone en niet UTC", () => {
    // 30 september 23:30 UTC is in Brussel al 1 oktober.
    expect(periodeMaand("2026-09-30T23:30:00.000Z")).toBe("2026-10-01");
  });

  it("noemt de maand in gewone taal", () => {
    expect(maandLabel("2026-09-01")).toContain("september");
  });

  it("vindt de kaart die het tegoed bezet houdt op een ándere match", () => {
    const elders = joker({ match_id: "m2" });
    expect(maandBezetDoor([elders], "m1", OVER_2_DAGEN)).toBe(elders);
  });

  it("rekent je eigen kaart op déze match niet als bezetting", () => {
    expect(maandBezetDoor([joker()], "m1", OVER_2_DAGEN)).toBeNull();
  });
});

describe("de blokkade (spiegel van match_jokers_guard)", () => {
  const basis = {
    isDeelnemer: true,
    games: MIN_GAMES,
    eigenJokers: [] as MatchJoker[],
  };

  it("laat een ingelopen deelnemer zijn kaart spelen", () => {
    expect(
      jokerBlokkade({ match: match(), joker: "schild", ...basis }),
    ).toBeNull();
  });

  it("weigert buiten een groep", () => {
    expect(
      jokerBlokkade({
        match: match({ group_id: null }),
        joker: "schild",
        ...basis,
      }),
    ).toBe("geen-groepsmatch");
  });

  it("weigert wie niet meespeelt", () => {
    expect(
      jokerBlokkade({
        match: match(),
        joker: "schild",
        ...basis,
        isDeelnemer: false,
      }),
    ).toBe("geen-deelnemer");
  });

  it("weigert zonder starttijd en na de aftrap", () => {
    expect(
      jokerBlokkade({
        match: match({ played_at: null }),
        joker: "schild",
        ...basis,
      }),
    ).toBe("geen-starttijd");
    expect(
      jokerBlokkade({
        match: match({ played_at: new Date(Date.now() - 1000).toISOString() }),
        joker: "schild",
        ...basis,
      }),
    ).toBe("gesloten");
    expect(
      jokerBlokkade({
        match: match({ status: "completed" }),
        joker: "schild",
        ...basis,
      }),
    ).toBe("gesloten");
  });

  it("weigert van kant wisselen in een enkel", () => {
    expect(
      jokerBlokkade({
        match: match({ format: "1v1" }),
        joker: "wissel_van_kant",
        ...basis,
      }),
    ).toBe("alleen-dubbel");
  });

  it("houdt de rating-kaarten tegen zolang de rating niet ingelopen is", () => {
    expect(
      jokerBlokkade({
        match: match(),
        joker: "dubbel_of_niets",
        ...basis,
        games: MIN_GAMES - 1,
      }),
    ).toBe("te-weinig-matches");
  });

  it("laat de sociale kaart wél toe zonder ingelopen rating", () => {
    expect(
      jokerBlokkade({
        match: match(),
        joker: "wissel_van_kant",
        ...basis,
        games: 0,
      }),
    ).toBeNull();
  });

  it("weigert een rating-kaart naast een eigen lef-tip", () => {
    expect(
      jokerBlokkade({
        match: match(),
        joker: "dubbel_of_niets",
        ...basis,
        eigenStakes: [stake()],
      }),
    ).toBe("lef-staat-al");
  });

  it("laat de sociale kaart wél naast een lef-tip staan", () => {
    expect(
      jokerBlokkade({
        match: match(),
        joker: "wissel_van_kant",
        ...basis,
        eigenStakes: [stake()],
      }),
    ).toBeNull();
  });

  it("weigert een tweede kaart in dezelfde maand", () => {
    expect(
      jokerBlokkade({
        match: match(),
        joker: "schild",
        ...basis,
        eigenJokers: [joker({ match_id: "m2" })],
      }),
    ).toBe("maand-bezet");
  });

  it("legt elke blokkade uit in gewone taal", () => {
    expect(jokerBlokkadeUitleg("te-weinig-matches", MIN_GAMES - 1)).toContain(
      "1 match",
    );
    expect(jokerBlokkadeUitleg("maand-bezet", 0)).toContain("kalendermaand");
    expect(jokerBlokkadeUitleg("lef-staat-al", 0)).toContain("lef");
    expect(jokerBlokkadeUitleg("alleen-dubbel", 0)).toContain("dubbelspel");
  });
});

describe("wie wat mag zien", () => {
  const mijn = joker({ player_id: "p1", joker: "schild" });
  const anders = joker({ player_id: "p2", joker: "dubbel_of_niets" });
  const sociaal = joker({ player_id: "p3", joker: "wissel_van_kant" });

  it("verbergt andermans risicokaart tot de aftrap", () => {
    const zichtbaar = zichtbareJokers({
      match: match(),
      jokers: [mijn, anders, sociaal],
      myId: "p1",
    });
    expect(zichtbaar).toEqual([mijn, sociaal]);
  });

  it("onthult alles zodra de match begonnen is", () => {
    const zichtbaar = zichtbareJokers({
      match: match({ status: "completed" }),
      jokers: [mijn, anders, sociaal],
      myId: "p1",
    });
    expect(zichtbaar).toHaveLength(3);
  });

  it("noemt van kant wisselen als enige kaart die vooraf bekend hoort te zijn", () => {
    expect(jokerVooraf("wissel_van_kant")).toBe(true);
    expect(jokerVooraf("schild")).toBe(false);
    expect(jokerVooraf("dubbel_of_niets")).toBe(false);
  });

  it("weet wanneer de aftrap geweest is", () => {
    expect(jokerGestart(match())).toBe(false);
    expect(jokerGestart(match({ status: "completed" }))).toBe(true);
    expect(
      jokerGestart(match({ played_at: new Date(Date.now() - 1).toISOString() })),
    ).toBe(true);
  });
});

describe("de kaartregel", () => {
  it("zwijgt zonder zichtbare kaarten", () => {
    expect(
      jokerKaartRegel({
        match: match(),
        jokers: [joker({ player_id: "p2", joker: "schild" })],
        teams: TEAMS,
        naam,
        myId: "p1",
      }),
    ).toBeNull();
  });

  it("noemt de kaart van een gespeelde match met de uitkomst", () => {
    const regel = jokerKaartRegel({
      match: match({
        status: "completed",
        winner_team_id: "t-ab",
        played_at: "2026-09-10T18:00:00.000Z",
      }),
      jokers: [
        joker({ player_id: "p1", joker: "dubbel_of_niets" }),
        joker({ player_id: "p3", joker: "schild" }),
      ],
      teams: TEAMS,
      naam,
      myId: "p1",
    });
    expect(regel).toContain("P1 — 🎲 Dubbel of niets, winst");
    expect(regel).toContain("P3 — 🛡️ Schild, verlies");
  });

  it("noemt een gelijkspel als gelijkspel", () => {
    const regel = jokerKaartRegel({
      match: match({ status: "completed", winner_team_id: null }),
      jokers: [joker({ player_id: "p1", joker: "dubbel_of_niets" })],
      teams: TEAMS,
      naam,
      myId: "p1",
    });
    expect(regel).toContain("gelijkspel");
  });

  it("filtert kaarten van andere matches weg", () => {
    expect(
      jokerKaartRegel({
        match: match(),
        jokers: [joker({ match_id: "m2", player_id: "p1" })],
        teams: TEAMS,
        naam,
        myId: "p1",
      }),
    ).toBeNull();
  });
});

describe("de foutmelding", () => {
  it("maakt van een botsing op het maandtegoed een zin", () => {
    expect(
      jokerFoutMelding({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "match_jokers_one_per_month"',
      }),
    ).toContain("kalendermaand");
  });

  it("herkent een tweede kaart op dezelfde match", () => {
    expect(
      jokerFoutMelding({
        code: "23505",
        message: 'duplicate key value violates unique constraint "match_jokers_pkey"',
      }),
    ).toContain("deze match");
  });

  it("laat de leesbare guard-meldingen ongemoeid", () => {
    expect(jokerFoutMelding({ message: "de match is al begonnen" })).toBe(
      "de match is al begonnen",
    );
  });

  it("valt terug op een nette zin zonder melding", () => {
    expect(jokerFoutMelding(null)).toContain("Probeer het zo nog eens");
  });
});
