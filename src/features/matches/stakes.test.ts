import { describe, it, expect } from "vitest";
import {
  MIN_GAMES,
  blokkadeUitleg,
  dagBezet,
  dagBezetDoor,
  lefGestart,
  lefKaartRegel,
  playDay,
  stakeBlokkade,
  stakeFactor,
  stakeFoutMelding,
  stakeSwing,
  type MatchStake,
} from "@/features/matches/stakes";
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

function stake(over: Partial<MatchStake> = {}): MatchStake {
  return {
    match_id: "m1",
    player_id: "p1",
    group_id: "g1",
    play_date: playDay(OVER_2_DAGEN),
    created_at: OVER_2_DAGEN,
    ...over,
  };
}

describe("stakeFactor", () => {
  it("verdubbelt alleen als er ingezet is én er een winnaar is", () => {
    expect(stakeFactor(true, true)).toBe(2);
    expect(stakeFactor(false, true)).toBe(1);
  });

  it("laat een gelijkspel ongemoeid", () => {
    // K · (0,5 − E) is voor een underdog positief: verdubbelen zou een
    // mislukte inzet belonen.
    expect(stakeFactor(true, false)).toBe(1);
  });
});

describe("stakeSwing", () => {
  it("verdubbelt beide kanten even hard", () => {
    expect(stakeSwing(0.5, false)).toEqual({ winst: 12, verlies: -12 });
    expect(stakeSwing(0.5, true)).toEqual({ winst: 24, verlies: -24 });
  });

  it("rondt één keer af, ná de vermenigvuldiging", () => {
    // 24 · 0,4 = 9,6 → 10, maar verdubbeld is het 19,2 → 19: twee keer
    // afronden zou 20 geven en van het databank-pad afwijken.
    expect(stakeSwing(0.6, false).winst).toBe(10);
    expect(stakeSwing(0.6, true).winst).toBe(19);
  });

  it("geeft de favoriet weinig te winnen en veel te verliezen", () => {
    const s = stakeSwing(0.9, true);
    expect(s.winst).toBe(5);
    expect(s.verlies).toBe(-43);
  });
});

describe("playDay", () => {
  it("rekent de speeldag in clubtijd, niet in UTC", () => {
    // 22:30 UTC is in Brussels (zomertijd, UTC+2) al de volgende dag.
    expect(playDay("2026-07-30T22:30:00Z")).toBe("2026-07-31");
    expect(playDay("2026-07-30T10:00:00Z")).toBe("2026-07-30");
  });
});

describe("dagBezet", () => {
  it("telt de eigen inzet op dezelfde match niet mee", () => {
    expect(dagBezet([stake()], "m1", OVER_2_DAGEN)).toBe(false);
  });

  it("blokkeert een tweede inzet op dezelfde speeldag", () => {
    expect(dagBezet([stake({ match_id: "m2" })], "m1", OVER_2_DAGEN)).toBe(true);
  });

  it("laat een inzet op een andere speeldag met rust", () => {
    const andere = stake({ match_id: "m2", play_date: "2020-01-01" });
    expect(dagBezet([andere], "m1", OVER_2_DAGEN)).toBe(false);
  });
});

describe("stakeBlokkade", () => {
  const basis = {
    match: match(),
    isDeelnemer: true,
    games: MIN_GAMES,
    eigenStakes: [] as MatchStake[],
  };

  it("laat een deelnemer met ingelopen rating door", () => {
    expect(stakeBlokkade(basis)).toBeNull();
  });

  it("weigert toeschouwers, niet-groepsmatches en matches zonder starttijd", () => {
    expect(stakeBlokkade({ ...basis, isDeelnemer: false })).toBe("geen-deelnemer");
    expect(stakeBlokkade({ ...basis, match: match({ group_id: null }) })).toBe(
      "geen-groepsmatch",
    );
    expect(stakeBlokkade({ ...basis, match: match({ played_at: null }) })).toBe(
      "geen-starttijd",
    );
  });

  it("sluit zodra de match begonnen of afgerond is", () => {
    const begonnen = match({ played_at: new Date(Date.now() - 60_000).toISOString() });
    expect(stakeBlokkade({ ...basis, match: begonnen })).toBe("gesloten");
    expect(stakeBlokkade({ ...basis, match: match({ status: "completed" }) })).toBe(
      "gesloten",
    );
  });

  it("houdt een nog niet ingelopen rating tegen", () => {
    expect(stakeBlokkade({ ...basis, games: MIN_GAMES - 1 })).toBe(
      "te-weinig-matches",
    );
  });

  it("staat één inzet per speeldag toe", () => {
    expect(
      stakeBlokkade({ ...basis, eigenStakes: [stake({ match_id: "m2" })] }),
    ).toBe("dag-bezet");
  });
});

describe("blokkadeUitleg", () => {
  it("telt af naar de drempel, met het juiste enkelvoud", () => {
    expect(blokkadeUitleg("te-weinig-matches", MIN_GAMES - 1)).toContain("1 match");
    expect(blokkadeUitleg("te-weinig-matches", MIN_GAMES - 3)).toContain("3 matches");
  });
});

describe("stakeFoutMelding", () => {
  // De unieke index is de échte poort voor het dagtegoed (race-vast), maar hij
  // praat Postgres. Wat de speler te zien kreeg was letterlijk:
  // 'duplicate key value violates unique constraint "match_stakes_one_per_day"'.
  it("vertaalt een botsing op het dagtegoed naar de blokkade-uitleg", () => {
    const melding = stakeFoutMelding({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "match_stakes_one_per_day"',
    });
    expect(melding).toBe(blokkadeUitleg("dag-bezet", 0));
    expect(melding).not.toContain("constraint");
  });

  it("herkent de botsing ook zonder code, op de tekst alleen", () => {
    expect(
      stakeFoutMelding({
        message:
          'duplicate key value violates unique constraint "match_stakes_one_per_day"',
      }),
    ).toBe(blokkadeUitleg("dag-bezet", 0));
  });

  it("onderscheidt een tweede inzet op dezelfde match", () => {
    // De primaire sleutel (match_id, player_id), niet het dagtegoed: dan klopt
    // "vandaag al vergeven" niet — je stond al op déze match.
    expect(
      stakeFoutMelding({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "match_stakes_pkey"',
      }),
    ).toBe("Je lef stond al op deze match.");
  });

  it("laat de leesbare meldingen van de guard ongemoeid", () => {
    expect(stakeFoutMelding({ message: "de match is al begonnen" })).toBe(
      "de match is al begonnen",
    );
  });

  it("valt terug op een zin, nooit op een leeg vak", () => {
    expect(stakeFoutMelding(null)).toBe(
      "Inzetten lukte niet. Probeer het zo nog eens.",
    );
    expect(stakeFoutMelding({})).toBe(
      "Inzetten lukte niet. Probeer het zo nog eens.",
    );
  });
});

// ── Onthulling en kaartregel (#981) ─────────────────────────────────────────

describe("lefGestart", () => {
  it("blijft dicht zolang de match gepland is en de starttijd niet voorbij", () => {
    expect(lefGestart(match())).toBe(false);
  });

  it("start zodra de starttijd voorbij is, ook al is de status nog scheduled", () => {
    const nu = new Date(OVER_2_DAGEN).getTime() + 1;
    expect(lefGestart(match(), nu)).toBe(true);
  });

  it("start op status, ook zonder verstreken starttijd", () => {
    expect(lefGestart(match({ status: "completed" }))).toBe(true);
    expect(lefGestart(match({ status: "cancelled" }))).toBe(true);
  });

  it("blijft dicht zonder starttijd", () => {
    expect(lefGestart(match({ played_at: null }))).toBe(false);
  });
});

describe("dagBezetDoor", () => {
  it("wijst de inzet aan die het tegoed bezet houdt", () => {
    const andere = stake({ match_id: "m2" });
    expect(dagBezetDoor([andere], "m1", OVER_2_DAGEN)).toBe(andere);
  });

  it("geeft null voor de eigen match of een andere speeldag", () => {
    expect(dagBezetDoor([stake()], "m1", OVER_2_DAGEN)).toBeNull();
    const andereDag = stake({ match_id: "m2", play_date: "2020-01-01" });
    expect(dagBezetDoor([andereDag], "m1", OVER_2_DAGEN)).toBeNull();
  });
});

describe("lefKaartRegel", () => {
  const TEAMS: Record<string, Team> = {
    "t-ab": {
      id: "t-ab",
      name: null,
      player1_id: "p1",
      player2_id: "p2",
      created_at: OVER_2_DAGEN,
    },
    "t-cd": {
      id: "t-cd",
      name: null,
      player1_id: "p3",
      player2_id: "p4",
      created_at: OVER_2_DAGEN,
    },
  } as Record<string, Team>;
  const naam = (id: string) => ({ p1: "Alice", p3: "Cor" })[id] ?? id;
  const regel = (m: Match, stakes: MatchStake[], now?: number) =>
    lefKaartRegel({ match: m, stakes, teams: TEAMS, naam, now });

  it("verklapt vóór de aftrap niets — ook niet met inzetten", () => {
    expect(regel(match(), [stake()])).toBeNull();
  });

  it("toont vanaf de aftrap wie er lef had, nog zonder uitkomst", () => {
    const nu = new Date(OVER_2_DAGEN).getTime() + 1;
    expect(regel(match(), [stake()], nu)).toBe("🎲 lef ×2 · Alice");
  });

  it("zet de uitkomst per inzetter bij een afgeronde match", () => {
    const klaar = match({ status: "completed", winner_team_id: "t-ab" });
    expect(
      regel(klaar, [stake(), stake({ player_id: "p3" })]),
    ).toBe("🎲 lef ×2 · Alice — winst · Cor — verlies");
  });

  it("laat een gelijkspel zien zonder ×2 — de inzet telde niet", () => {
    const gelijk = match({ status: "completed", winner_team_id: null });
    expect(regel(gelijk, [stake()])).toBe(
      "🎲 lef · Alice — gelijkspel, telt niet",
    );
  });

  it("filtert op de eigen match en zwijgt zonder inzetten", () => {
    const klaar = match({ status: "completed", winner_team_id: "t-ab" });
    expect(regel(klaar, [stake({ match_id: "m2" })])).toBeNull();
    expect(regel(klaar, [])).toBeNull();
  });
});
