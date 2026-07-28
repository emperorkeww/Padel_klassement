import { describe, it, expect } from "vitest";
import {
  MIN_GAMES,
  blokkadeUitleg,
  dagBezet,
  playDay,
  stakeBlokkade,
  stakeFactor,
  stakeSwing,
  type MatchStake,
} from "@/features/matches/stakes";
import type { Match } from "@/types";

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
