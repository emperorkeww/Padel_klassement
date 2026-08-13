import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// #1271 — offline werkte precies niet waar je offline bent.
//
// De wachtrij dekte alleen het *aanmaken* van matches (loggen en plannen). Het
// invullen van een klaargezette ronde liep langs een kale PostgREST-update en
// faalde zonder bereik gewoon — in de kooi, op het moment dat je het doet. De
// uitlegpagina beloofde het tegenovergestelde.

const api = vi.hoisted(() => ({
  createCompletedMatch: vi.fn(async () => "m1"),
  createPlannedMatch: vi.fn(async () => "m2"),
  setMatchResult: vi.fn<(p: Record<string, unknown>) => Promise<void>>(
    async () => {},
  ),
  UitslagAlIngevuld: class UitslagAlIngevuld extends Error {
    constructor() {
      super("Deze uitslag is al door iemand anders ingevuld.");
      this.name = "UitslagAlIngevuld";
    }
  },
}));
vi.mock("@/features/matches/api", () => api);

import {
  flush,
  getCount,
  saveMatchResult,
} from "@/features/matches/outbox";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

const UITSLAG = {
  matchId: "m-1",
  winnerTeamId: "t-a",
  scoreA: 6,
  scoreB: 3,
  setScores: null,
  playedAt: "2026-09-04T18:00:00.000Z",
};

describe("saveMatchResult (#1271)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setOnline(true);
  });
  afterEach(() => setOnline(true));

  it("schrijft direct weg zolang er bereik is", async () => {
    await expect(saveMatchResult(UITSLAG)).resolves.toMatchObject({
      status: "saved",
    });
    expect(api.setMatchResult).toHaveBeenCalledOnce();
    expect(getCount()).toBe(0);
  });

  it("zet de uitslag in de wachtrij zonder bereik", async () => {
    setOnline(false);
    await expect(saveMatchResult(UITSLAG)).resolves.toMatchObject({
      status: "queued",
    });
    expect(api.setMatchResult).not.toHaveBeenCalled();
    expect(getCount()).toBe(1);
  });

  it("klikt de speeltijd vast bij het invoeren, niet bij het versturen", async () => {
    // Anders krijgt een match die je om 21:00 invulde de tijd van de volgende
    // ochtend mee — met alle gevolgen voor zijn speeldag en de Elo-volgorde.
    setOnline(false);
    const voor = Date.now();
    await saveMatchResult({ ...UITSLAG, playedAt: null });
    setOnline(true);
    await flush();

    const gebruikt = api.setMatchResult.mock.calls[0]![0] as {
      playedAt: string;
    };
    const t = new Date(gebruikt.playedAt).getTime();
    expect(t).toBeGreaterThanOrEqual(voor);
    expect(t).toBeLessThanOrEqual(Date.now());
  });

  it("behoudt de geplande speeltijd in de wachtrij", async () => {
    setOnline(false);
    await saveMatchResult(UITSLAG);
    setOnline(true);
    await flush();
    expect(api.setMatchResult).toHaveBeenCalledWith(
      expect.objectContaining({ playedAt: "2026-09-04T18:00:00.000Z" }),
    );
  });

  it("telt 'al ingevuld' als succes in plaats van als poison item", async () => {
    // Bij een replay is dat precies wat het item wilde bereiken. De guard
    // `.neq("status","completed")` maakt de update veilig; wat overblijft is
    // een melding die voor de wachtrij geen fout is.
    setOnline(false);
    await saveMatchResult(UITSLAG);
    setOnline(true);
    api.setMatchResult.mockRejectedValueOnce(new api.UitslagAlIngevuld());

    const uit = await flush();
    expect(uit.sent).toBe(1);
    expect(uit.dropped).toEqual([]);
    expect(getCount()).toBe(0);
  });

  it("dropt een échte afwijzing wél, zodat de queue niet blokkeert", async () => {
    setOnline(false);
    await saveMatchResult(UITSLAG);
    setOnline(true);
    api.setMatchResult.mockRejectedValueOnce(new Error("geen rechten"));

    const uit = await flush();
    expect(uit.sent).toBe(0);
    expect(uit.dropped).toHaveLength(1);
    expect(getCount()).toBe(0);
  });

  it("houdt een netwerkfout vast voor later", async () => {
    setOnline(false);
    await saveMatchResult(UITSLAG);
    setOnline(true);
    api.setMatchResult.mockRejectedValueOnce(new Error("failed to fetch"));

    const uit = await flush();
    expect(uit.sent).toBe(0);
    expect(uit.dropped).toEqual([]);
    expect(getCount()).toBe(1);
  });
});
