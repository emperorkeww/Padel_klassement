// Kwartaal-Wrapped (#712): de periode-abstractie, het kwartaal-deck en de
// periode-bewuste copy. Het jaardeck zelf blijft in wrapped.test.ts.

import { describe, it, expect } from "vitest";
import {
  SEIZOEN_BANNER_DAGEN,
  derivePeriodeWrapped,
  deriveWrapped,
  jaarPeriode,
  matchesInPeriode,
  seizoenPeriode,
  seizoenWrappedVenster,
} from "./wrapped";
import type { WrappedCard } from "./wrapped";
import { posterLayout } from "./wrappedPoster";
import { coachEindoordeel, coachWrappedRegel } from "./coachWrapped";
import { seasonFromId } from "@/features/rating/seasons";
import type { Match, Profile, RatingPoint, Team } from "@/types";

const Q3 = seasonFromId("2026-q3")!;
const Q4 = seasonFromId("2026-q4")!;

const teams: Record<string, Team> = {
  tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
};

const profiles: Record<string, Profile> = Object.fromEntries(
  ["p1", "p2", "p3", "p4"].map((id, i) => [
    id,
    {
      id,
      username: `speler${i + 1}`,
      full_name: `Speler ${i + 1}`,
      avatar_url: null,
      created_at: "",
    },
  ]),
);

let seq = 0;
function op(iso: string, part: Partial<Match> = {}): Match {
  seq += 1;
  return {
    id: `m${seq}`,
    team_a_id: "tA",
    team_b_id: "tB",
    status: "completed",
    winner_team_id: "tA",
    played_at: iso,
    created_by: null,
    created_at: iso,
    group_id: null,
    round_number: null,
    score_a: 6,
    score_b: 3,
    format: "2v2",
    ...part,
  };
}

const kaart = <K extends WrappedCard["kind"]>(
  cards: WrappedCard[],
  kind: K,
): Extract<WrappedCard, { kind: K }> | undefined =>
  cards.find((c) => c.kind === kind) as Extract<WrappedCard, { kind: K }> | undefined;

/** Zeven zomermatches: genoeg voor de volle variant. */
const ZOMER = [
  op("2026-07-03T19:00:00"),
  op("2026-07-10T19:00:00"),
  op("2026-07-17T19:00:00"),
  op("2026-08-07T19:00:00"),
  op("2026-08-14T19:00:00", { winner_team_id: "tB", score_a: 2, score_b: 6 }),
  op("2026-09-04T19:00:00"),
  op("2026-09-11T19:00:00"),
];

const deck = (matches: Match[], extra = {}) =>
  derivePeriodeWrapped({
    periode: seizoenPeriode(Q3),
    matches,
    teams,
    profiles,
    playerId: "p1",
    ...extra,
  });

describe("jaarPeriode & seizoenPeriode", () => {
  it("geeft het jaar zijn eigen copy en grenzen", () => {
    const p = jaarPeriode(2026);
    expect(p).toMatchObject({
      soort: "jaar",
      id: "2026",
      noemer: "jaar",
      kicker: "Wrapped 2026",
      titel: "2026",
      volgendeTitel: "2027",
      kaartKicker: "Seizoen 2026",
    });
    expect(p.start.getTime()).toBe(new Date(2026, 0, 1).getTime());
    expect(p.end.getTime()).toBe(new Date(2027, 0, 1).getTime());
  });

  it("geeft het kwartaal zijn seizoensnaam en het volgende kwartaal", () => {
    expect(seizoenPeriode(Q3)).toMatchObject({
      soort: "seizoen",
      id: "2026-q3",
      noemer: "seizoen",
      kicker: "☀️ Zomer Wrapped",
      titel: "Zomer 2026",
      volgendeTitel: "Herfst 2026",
      kaartWoord: "ZOMER",
      kaartEditie: "☀️ Zomer 2026",
    });
  });

  it("rolt over de jaarwissel naar de winter", () => {
    expect(seizoenPeriode(Q4).volgendeTitel).toBe("Winter 2027");
  });
});

describe("matchesInPeriode", () => {
  it("houdt alleen de matches binnen [start, einde)", () => {
    const ms = [
      op("2026-06-30T23:59:00"), // Q2
      op("2026-07-01T00:00:00"), // Q3, eerste tel
      op("2026-09-30T23:59:00"), // Q3, laatste tel
      op("2026-10-01T00:00:00"), // Q4
    ];
    expect(matchesInPeriode(ms, seizoenPeriode(Q3)).map((m) => m.played_at)).toEqual([
      "2026-07-01T00:00:00",
      "2026-09-30T23:59:00",
    ]);
  });
});

describe("seizoenWrappedVenster", () => {
  it("toont het net afgesloten kwartaal in de eerste twee weken", () => {
    expect(seizoenWrappedVenster(new Date(2026, 6, 1, 9))?.id).toBe("2026-q2");
    expect(seizoenWrappedVenster(new Date(2026, 6, 14, 23))?.id).toBe("2026-q2");
  });

  it("zwijgt zodra het nieuwe kwartaal ouder is dan het venster", () => {
    const dag15 = new Date(2026, 6, 1 + SEIZOEN_BANNER_DAGEN);
    expect(seizoenWrappedVenster(dag15)).toBeNull();
  });

  it("wijkt voor het jaar-Wrapped in januari", () => {
    // 1 januari is óók de eerste dag van Q1, maar dan loopt het jaarvenster nog.
    expect(seizoenWrappedVenster(new Date(2027, 0, 3))).toBeNull();
    expect(seizoenWrappedVenster(new Date(2026, 11, 20))).toBeNull();
  });
});

describe("kwartaal-deck", () => {
  it("draagt de periode mee in de data", () => {
    const d = deck(ZOMER)!;
    expect(d.periode.id).toBe("2026-q3");
    expect(d.jaar).toBe(2026);
    expect(d.variant).toBe("vol");
  });

  it("negeert matches buiten het kwartaal", () => {
    const d = deck([...ZOMER, op("2026-05-01T19:00:00"), op("2026-11-01T19:00:00")])!;
    expect(kaart(d.cards, "volume")?.gespeeld).toBe(ZOMER.length);
  });

  it("geeft de favoriete tegenstander een eigen slachtoffer-kaart", () => {
    const d = deck(ZOMER)!;
    const slachtoffer = kaart(d.cards, "slachtoffer");
    expect(slachtoffer?.rivaal.naam).toBe("Speler 3");
    // De favoriet staat níet óók op de rivalen-kaart.
    expect(kaart(d.cards, "rivalen")?.favoriet ?? null).toBeNull();
  });

  it("houdt de slachtoffer-kaart uit het jaardeck", () => {
    const jaar = deriveWrapped({
      jaar: 2026,
      matches: ZOMER,
      teams,
      profiles,
      playerId: "p1",
    })!;
    expect(kaart(jaar.cards, "slachtoffer")).toBeUndefined();
    expect(kaart(jaar.cards, "rivalen")?.favoriet?.naam).toBe("Speler 3");
    expect(jaar.periode.soort).toBe("jaar");
  });

  it("scoopt de rating-reis op het kwartaal", () => {
    const punt = (played_at: string, before: number, after: number): RatingPoint => ({
      match_id: "x",
      rating_before: before,
      rating_after: after,
      delta: after - before,
      played_at,
    });
    const d = deck(ZOMER, {
      ratingHistory: [
        punt("2026-04-01T19:00:00", 900, 1000), // Q2 — telt niet mee
        punt("2026-07-03T19:00:00", 1000, 1020),
        punt("2026-09-11T19:00:00", 1020, 1050),
      ],
    })!;
    expect(kaart(d.cards, "rating")).toMatchObject({ start: 1000, eind: 1050 });
    expect(d.jaarStats.ratingDelta).toBe(50);
  });

  it("geeft null zonder matches in het kwartaal", () => {
    expect(deck([op("2026-05-01T19:00:00")])).toBeNull();
  });
});

describe("posterLayout met een kwartaal", () => {
  const layout = (card: WrappedCard) =>
    posterLayout(card, "Speler 1", seizoenPeriode(Q3));

  it("zet de seizoensnaam in de kicker", () => {
    expect(layout({ kind: "cover", jaar: 2026, naam: "Speler 1", gespeeld: 7, kort: false }))
      .toMatchObject({ kicker: "☀️ Zomer Wrapped" });
  });

  it("spreekt over het seizoen, niet over het jaar", () => {
    const cover = layout({
      kind: "cover",
      jaar: 2026,
      naam: "Speler 1",
      gespeeld: 7,
      kort: false,
    });
    expect(cover.sub[0]).toBe("Jouw seizoen in padel");

    const rating = layout({ kind: "rating", start: 1050, piek: 1050, eind: 1000 });
    expect(rating.sub[1]).toBe("-50 dit seizoen — volgend seizoen pak je ze terug");

    const outro = layout({ kind: "outro", jaar: 2026, kort: false });
    expect(outro.sub[0]).toBe("Vamos! Op naar Herfst 2026");
  });

  it("beschrijft het slachtoffer met zijn balans", () => {
    const l = layout({
      kind: "slachtoffer",
      rivaal: { naam: "Speler 3", gewonnen: 5, verloren: 1, gespeeld: 6 },
    });
    expect(l).toMatchObject({ kicker: "🎯 Jouw favoriete slachtoffer", hero: "Speler 3" });
    expect(l.sub[0]).toBe("5 van 6 gewonnen");
  });
});

describe("Coach Rudy over een kwartaal", () => {
  const ctx = { intensiteit: "gemeen", schild: false } as const;

  it("gebruikt kwartaal-copy op de cover", () => {
    const jaar = coachWrappedRegel(
      { kind: "cover", jaar: 2026, naam: "S", gespeeld: 7, kort: false },
      ctx,
      3,
      undefined,
      "jaar",
    );
    const seizoen = coachWrappedRegel(
      { kind: "cover", jaar: 2026, naam: "S", gespeeld: 7, kort: false },
      ctx,
      3,
      undefined,
      "seizoen",
    );
    expect(jaar.tekst).not.toBe(seizoen.tekst);
    expect(seizoen.tekst).not.toMatch(/jaar/i);
  });

  it("zegt nooit 'jaar' in een kwartaaloverzicht", () => {
    // Alle kaartsoorten × een reeks seeds: geen enkele regel mag het
    // jaar-register gebruiken (zonderJaar + de eigen kwartaal-pools).
    const kaarten: WrappedCard[] = [
      { kind: "cover", jaar: 2026, naam: "S", gespeeld: 7, kort: false },
      { kind: "volume", gespeeld: 7, gewonnen: 2, winrate: 29 },
      { kind: "volume", gespeeld: 7, gewonnen: 6, winrate: 86 },
      { kind: "volume", gespeeld: 7, gewonnen: 4, winrate: 50 },
      { kind: "kalender", maand: { label: "juli", aantal: 3 }, topdag: { label: "vr 3 juli", aantal: 2 } },
      { kind: "reeks", type: "winst", lengte: 4 },
      { kind: "reeks", type: "verlies", lengte: 5 },
      { kind: "maatje", naam: "S2", samen: 5, gewonnen: 3 },
      { kind: "rivalen", favoriet: null, nemesis: { naam: "S3", gewonnen: 1, verloren: 4, gespeeld: 5 } },
      { kind: "slachtoffer", rivaal: { naam: "S3", gewonnen: 4, verloren: 1, gespeeld: 5 } },
      { kind: "prestatie", zege: { score: "6–0", marge: 6 }, comeback: null },
      { kind: "rating", start: 1000, piek: 1050, eind: 1050 },
      { kind: "rating", start: 1050, piek: 1050, eind: 1000 },
      { kind: "rating", start: 1000, piek: 1000, eind: 1000 },
      { kind: "badge", badgeId: "b", naam: "Badge", emoji: "🦄", aantalSpelers: 1 },
      { kind: "outro", jaar: 2026, kort: false },
      {
        kind: "seizoenskaart",
        naam: "S",
        rating: 1050,
        tier: null,
        avatarUrl: null,
        maatje: null,
        langsteReeks: null,
        aantalRoasts: 8,
      },
    ];
    for (let seed = 0; seed < 25; seed++) {
      for (const card of kaarten) {
        for (const schild of [false, true]) {
          const r = coachWrappedRegel(card, { ...ctx, schild }, seed, undefined, "seizoen");
          expect(r.tekst, `${card.kind} seed ${seed}`).not.toMatch(/jaar/i);
        }
      }
    }
  });

  it("houdt ook het eindoordeel vrij van jaar-woorden", () => {
    for (let seed = 0; seed < 25; seed++) {
      for (const winrate of [null, 30, 50, 70]) {
        for (const schild of [false, true]) {
          const eo = coachEindoordeel(
            {
              gespeeld: 10,
              gewonnen: 5,
              verloren: 5,
              winrate,
              langsteWinst: 4,
              langsteVerlies: 4,
              bagelsVoor: 2,
              bagelsTegen: 3,
              ratingDelta: -20,
            },
            { ...ctx, schild },
            seed,
            "seizoen",
          );
          for (const regel of [eo.kop, ...eo.regels]) {
            expect(regel, `seed ${seed} wr ${winrate}`).not.toMatch(/jaar/i);
          }
        }
      }
    }
  });

  it("laat het jaardeck ongemoeid (jaar-copy blijft toegestaan)", () => {
    const regels = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      regels.add(
        coachWrappedRegel(
          { kind: "outro", jaar: 2026, kort: false },
          ctx,
          seed,
          undefined,
          "jaar",
        ).tekst,
      );
    }
    expect([...regels].some((r) => /jaar/i.test(r))).toBe(true);
  });
});
