import { beforeEach, describe, expect, it, vi } from "vitest";

// De hele module bestaat om één ding te beslissen: schrijft deze klik
// rechtstreeks op public.matches (RLS laat het toe, geen spoor nodig), of gaat
// hij langs de edge function `admin-content` (service-role + auditrij)? Loopt
// dat mis, dan krijgt een beheerder een knop die stil faalt — of erger, blijft
// een ingreep in andermans groep buiten het logboek.

const matchesApi = vi.hoisted(() => ({
  deleteMatch: vi.fn(async () => {}),
  setMatchResult: vi.fn(async () => {}),
  updateMatchScore: vi.fn(async () => {}),
  updatePlannedMatchTime: vi.fn(async () => {}),
}));

// Met expliciete parameters, zodat `mock.calls[0][0]` getypeerd is en de test
// de payload kan uitpluizen in plaats van alleen "is aangeroepen".
const adminApi = vi.hoisted(() => ({
  corrigeerUitslag:
    vi.fn<(payload: Record<string, unknown>) => Promise<void>>(async () => {}),
  verplaatsMatch:
    vi.fn<(id: string, playedAt: string | null) => Promise<void>>(async () => {}),
  verwijderMatchAlsBeheerder: vi.fn<(id: string) => Promise<void>>(async () => {}),
}));

vi.mock("@/features/matches/api", () => matchesApi);
vi.mock("./api", () => adminApi);

import {
  slaCorrectieOp,
  verwijderMatchSlim,
  verzetTijdstip,
  vulUitslagIn,
} from "./matchBeheer";

const CORRECTIE = {
  matchId: "m1",
  winnerTeamId: "tb",
  scoreA: 3,
  scoreB: 6,
  setScores: null,
};

describe("matchBeheer (#1159)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("schrijft rechtstreeks wanneer de kijker op eigen titel mag", () => {
    slaCorrectieOp(CORRECTIE, false);
    verzetTijdstip("m1", "2026-08-09T18:00:00Z", false);
    verwijderMatchSlim("m1", false);

    expect(matchesApi.updateMatchScore).toHaveBeenCalledWith(CORRECTIE);
    expect(matchesApi.updatePlannedMatchTime).toHaveBeenCalledWith({
      matchId: "m1",
      playedAt: "2026-08-09T18:00:00Z",
    });
    expect(matchesApi.deleteMatch).toHaveBeenCalledWith("m1");
    // En níet langs de beheerdersroute: dat zou een auditrij opleveren voor een
    // aanmaker die gewoon zijn eigen uitslag rechtzet.
    expect(adminApi.corrigeerUitslag).not.toHaveBeenCalled();
    expect(adminApi.verplaatsMatch).not.toHaveBeenCalled();
    expect(adminApi.verwijderMatchAlsBeheerder).not.toHaveBeenCalled();
  });

  it("gaat langs de edge function wanneer het recht uit de beheerdersrol komt", () => {
    slaCorrectieOp(CORRECTIE, true);
    verzetTijdstip("m1", null, true);
    verwijderMatchSlim("m1", true);

    expect(adminApi.corrigeerUitslag).toHaveBeenCalledWith({
      matchId: "m1",
      scoreA: 3,
      scoreB: 6,
      winnerTeamId: "tb",
      setScores: null,
    });
    expect(adminApi.verplaatsMatch).toHaveBeenCalledWith("m1", null);
    expect(adminApi.verwijderMatchAlsBeheerder).toHaveBeenCalledWith("m1");
    expect(matchesApi.updateMatchScore).not.toHaveBeenCalled();
    expect(matchesApi.deleteMatch).not.toHaveBeenCalled();
  });

  it("rondt de match af wanneer de beheerder een uitslag invult", () => {
    // setMatchResult zet zelf status='completed'; de beheerdersroute is een
    // gewone update en moet dat expliciet meesturen, anders blijft de match
    // 'scheduled' staan mét een uitslag en telt hij nergens in mee.
    vulUitslagIn({ ...CORRECTIE, setScores: null }, true);
    expect(adminApi.corrigeerUitslag).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("laat played_at met rust bij een beheerder die achteraf invult", () => {
    // De beheerdersroute is een gewone update: alles wat niet expliciet in de
    // payload staat blijft in de database staan. Het geplande tijdstip mag er
    // dus niet in belanden, ook niet als de kaart het meestuurt.
    vulUitslagIn({ ...CORRECTIE, playedAt: "2026-08-12T18:00:00Z" }, true);
    const payload = adminApi.corrigeerUitslag.mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(payload).not.toHaveProperty("playedAt");
    expect(payload).not.toHaveProperty("played_at");
  });

  it("gebruikt setMatchResult voor een gewone deelnemer", () => {
    vulUitslagIn(CORRECTIE, false);
    expect(matchesApi.setMatchResult).toHaveBeenCalledWith(CORRECTIE);
    expect(adminApi.corrigeerUitslag).not.toHaveBeenCalled();
  });

  it("reikt de geplande speeltijd door aan setMatchResult (#1271)", () => {
    // Zonder dit zet setMatchResult played_at op nu en verhuist een 's ochtends
    // ingevulde ronde naar vandaag — weg van zijn eigen speeldagpagina.
    vulUitslagIn({ ...CORRECTIE, playedAt: "2026-08-12T18:00:00Z" }, false);
    expect(matchesApi.setMatchResult).toHaveBeenCalledWith(
      expect.objectContaining({ playedAt: "2026-08-12T18:00:00Z" }),
    );
  });
});
