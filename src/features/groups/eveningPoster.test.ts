import { describe, it, expect } from "vitest";
import {
  avondDatumLabel,
  eveningCoachQuote,
  eveningPoster,
  uitslagenPassing,
  verdeelVerticaal,
} from "@/features/groups/eveningPoster";
import { SNEER } from "@/features/coach/roastTone";
import type { KaartData } from "@/features/profiles/profielPoster";
import type { EveningRow, EveningSummary } from "@/features/feed/eveningSummary";
import type { Match, Profile } from "@/types";

// Testhulpjes: alleen de velden die de poster aanraakt.

const row = (playerId: string, punten: number, won = 2, lost = 0): EveningRow => ({
  playerId,
  played: won + lost,
  won,
  drawn: 0,
  lost,
  points: punten,
  goalDiff: 0,
});

const match = (id: string, a: number, b: number): Match =>
  ({
    id,
    team_a_id: `t-${id}-a`,
    team_b_id: `t-${id}-b`,
    score_a: a,
    score_b: b,
  }) as Match;

const summary = (over: Partial<EveningSummary> = {}): EveningSummary => ({
  matches: [match("m1", 6, 3)],
  rows: [row("p1", 9), row("p2", 6), row("p3", 3)],
  bestDuo: null,
  biggestUpset: null,
  ...over,
});

const opts = {
  groepsnaam: "De Smashers",
  datum: "vrijdag 17 juli",
  naam: (id: string) => id.toUpperCase(),
  duo: (id: string) => `duo ${id}`,
  coachQuote: null,
};

/** Minimale kaart voor de winnaar (#895) — alleen de velden die de poster
 *  doorgeeft aan `drawKaart`. */
const KAART: KaartData = {
  name: "P1",
  avatarUrl: null,
  rating: 1180,
  tier: null,
  editie: null,
  editieTekst: null,
};

describe("eveningPoster", () => {
  it("zet de top 3 op het podium met plaats, naam en punten", () => {
    const p = eveningPoster(summary(), opts);
    expect(p.podium).toEqual([
      { plaats: 1, naam: "P1", punten: 9 },
      { plaats: 2, naam: "P2", punten: 6 },
      { plaats: 3, naam: "P3", punten: 3 },
    ]);
    expect(p.groepsnaam).toBe("De Smashers");
    expect(p.datum).toBe("vrijdag 17 juli");
  });

  it("zet spelers buiten de top 3 in 'Ook gespeeld'", () => {
    const p = eveningPoster(
      summary({ rows: [row("p1", 9), row("p2", 6), row("p3", 3), row("p4", 1)] }),
      opts,
    );
    expect(p.ookGespeeld).toBe("Ook gespeeld: P4");
  });

  it("laat 'Ook gespeeld' weg bij precies drie spelers", () => {
    expect(eveningPoster(summary(), opts).ookGespeeld).toBeNull();
  });

  it("maakt van elke match een uitslagregel", () => {
    const p = eveningPoster(summary({ matches: [match("m1", 6, 3)] }), opts);
    expect(p.uitslagen).toHaveLength(1);
    expect(p.uitslagen[0]).toContain("duo t-m1-a");
    expect(p.uitslagen[0]).toContain("6 – 3");
  });

  it("toont een streepje voor een ontbrekende score", () => {
    const p = eveningPoster(summary({ matches: [match("m1", 6, null as never)] }), opts);
    expect(p.uitslagen[0]).toContain("6 – –");
  });

  it("verwoordt het beste duo met enkelvoud/meervoud", () => {
    expect(
      eveningPoster(summary({ bestDuo: { teamId: "t9", won: 1 } }), opts).bestDuo,
    ).toBe("🏆 Beste duo: duo t9 · 1 winst");
    expect(
      eveningPoster(summary({ bestDuo: { teamId: "t9", won: 3 } }), opts).bestDuo,
    ).toBe("🏆 Beste duo: duo t9 · 3 winsten");
  });

  // De kaart van de winnaar (#895): de avondposter toonde tot dan toe geen
  // enkele FUT-kaart, terwijl de app er overal mee werkt.
  it("vraagt de kaart van de nummer 1, niet van de eerste rij in de invoer", () => {
    const gevraagd: string[] = [];
    const p = eveningPoster(summary({ rows: [row("p2", 6), row("p1", 9)] }), {
      ...opts,
      kaart: (id) => {
        gevraagd.push(id);
        return { ...KAART, name: id.toUpperCase() };
      },
    });
    // `summary.rows` is al gesorteerd; de winnaar is dus rows[0].
    expect(gevraagd).toEqual(["p2"]);
    expect(p.winnaar?.name).toBe("P2");
  });

  it("blijft zonder kaart-resolver werken", () => {
    // De poster mag niet afhangen van ratings en editie-context: die worden
    // pas bij het delen opgehaald en kunnen falen.
    expect(eveningPoster(summary(), opts).winnaar).toBeNull();
  });

  it("laat de kaart weg als de resolver niets vindt", () => {
    const p = eveningPoster(summary(), { ...opts, kaart: () => null });
    expect(p.winnaar).toBeNull();
  });

  it("laat de kaart weg op een avond zonder spelers", () => {
    const p = eveningPoster(summary({ rows: [] }), {
      ...opts,
      kaart: () => KAART,
    });
    expect(p.winnaar).toBeNull();
    expect(p.podium).toEqual([]);
  });
});

describe("avondDatumLabel", () => {
  it("schrijft de clubdag voluit in het Nederlands", () => {
    expect(avondDatumLabel("2026-07-17")).toBe("vrijdag 17 juli");
  });
});

describe("eveningCoachQuote", () => {
  const profiles: Record<string, Profile> = {
    p1: { id: "p1", roast_schild: false } as Profile,
    p3: { id: "p3", roast_schild: false } as Profile,
  };
  const ctx = {
    intensiteit: "gemeen" as const,
    profiles,
    naam: (id: string) => id.toUpperCase(),
  };
  // p3 verloor vaker dan hij won → doelwit van de sneer.
  const avond = summary({ rows: [row("p1", 9), row("p3", 0, 0, 3)] });

  it("quote met mic, naam en aanhalingstekens (patroon van #202)", () => {
    const quote = eveningCoachQuote(avond, "g1|2026-07-17", ctx);
    expect(quote).toContain("🎙️");
    expect(quote).toContain("Coach Rudy:");
    expect(quote).toMatch(/“.*”$/);
  });

  it("is deterministisch bij gelijke seed", () => {
    expect(eveningCoachQuote(avond, "g1|2026-07-17", ctx)).toBe(
      eveningCoachQuote(avond, "g1|2026-07-17", ctx),
    );
  });

  it("zwijgt zonder avondstand", () => {
    expect(eveningCoachQuote(summary({ rows: [] }), "g1|2026-07-17", ctx)).toBeNull();
  });

  it("laat de sneer weg bij roast-schild, maar meldt het feit wel", () => {
    const schild = {
      ...ctx,
      profiles: { ...profiles, p3: { id: "p3", roast_schild: true } as Profile },
    };
    const quote = eveningCoachQuote(avond, "g1|2026-07-17", schild)!;
    // Punt achter het feit i.p.v. de "— <sneer>"-staart.
    expect(quote).toContain("P3 ging 3 keer onderuit.");
    expect(SNEER.gemeen.some((s) => quote.includes(s))).toBe(false);
  });
});

describe("uitslagenPassing", () => {
  it("toont alles als alles past", () => {
    expect(uitslagenPassing(4, 300, 50, 40)).toEqual({ toon: 4, rest: 0 });
  });

  it("reserveert ruimte voor '+ N meer' als het niet past", () => {
    // 200px / 50 = 4 rijen, maar met 40px voor de restregel passen er 3.
    expect(uitslagenPassing(10, 200, 50, 40)).toEqual({ toon: 3, rest: 7 });
  });

  it("valt terug op alleen de restregel bij extreem weinig ruimte", () => {
    expect(uitslagenPassing(10, 30, 50, 40)).toEqual({ toon: 0, rest: 10 });
  });

  it("gaat niet onder nul bij negatieve ruimte", () => {
    expect(uitslagenPassing(10, -100, 50, 40)).toEqual({ toon: 0, rest: 10 });
  });
});

describe("verdeelVerticaal", () => {
  it("stapelt blokken met minstens minGap ertussen", () => {
    const ys = verdeelVerticaal([{ h: 100 }, { h: 100 }, { h: 100 }], 0, 400, 20);
    expect(ys[0]).toBe(0);
    // 400 - 300 = 100 rest over 2 gaps van 20 → 30 extra elk = gap 50.
    expect(ys[1]).toBe(150);
    expect(ys[2]).toBe(300);
  });

  it("verdeelt de restruimte naar groei-gewicht", () => {
    const ys = verdeelVerticaal(
      [{ h: 100, groei: 3 }, { h: 100, groei: 1 }, { h: 100 }],
      0,
      500,
      0,
    );
    // 200 rest, gewichten 3:1 → gaps van 150 en 50.
    expect(ys).toEqual([0, 250, 400]);
  });

  it("houdt de laatste blok binnen de bodem", () => {
    const ys = verdeelVerticaal([{ h: 100 }, { h: 82 }], 0, 400, 20);
    expect(ys[1] + 82).toBeLessThanOrEqual(400);
  });

  it("laat een schaarse avond ademen i.p.v. één dood gat te maken", () => {
    // Weinig inhoud: de lucht komt tússen de blokken, niet als één gat onderaan.
    const ys = verdeelVerticaal([{ h: 50 }, { h: 50 }, { h: 50 }], 0, 950, 20);
    const gap1 = ys[1] - (ys[0] + 50);
    const gap2 = ys[2] - (ys[1] + 50);
    expect(gap1).toBeCloseTo(gap2);
    expect(gap1).toBeGreaterThan(20);
  });

  it("rekt gaps niet verder op dan maxGap, maar centreert de stapel", () => {
    // 800 vrij over 2 gaps zou 400 per gap worden; met maxGap 96 blijft er
    // 800 - 192 = 608 over, gelijk verdeeld boven en onder (304).
    const ys = verdeelVerticaal([{ h: 50 }, { h: 50 }, { h: 50 }], 0, 950, 20, 96);
    expect(ys).toEqual([304, 450, 596]);
    const onder = 950 - (ys[2] + 50);
    expect(onder).toBe(ys[0]); // even veel lucht boven als onder
  });

  it("houdt de gaps binnen maxGap ook bij ongelijke groei", () => {
    const ys = verdeelVerticaal(
      [{ h: 50, groei: 5 }, { h: 50, groei: 1 }, { h: 50 }],
      0,
      950,
      20,
      96,
    );
    expect(ys[1] - (ys[0] + 50)).toBeLessThanOrEqual(96);
    expect(ys[2] - (ys[1] + 50)).toBeLessThanOrEqual(96);
  });

  it("valt terug op minGap als de inhoud niet past", () => {
    const ys = verdeelVerticaal([{ h: 300 }, { h: 300 }], 0, 400, 20);
    expect(ys).toEqual([0, 320]);
  });

  it("geeft niets terug zonder blokken", () => {
    expect(verdeelVerticaal([], 0, 400, 20)).toEqual([]);
  });
});
