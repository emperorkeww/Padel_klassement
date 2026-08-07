import { describe, it, expect } from "vitest";
import {
  matchEffecten,
  heeftEffect,
  GEEN_EFFECTEN,
} from "@/features/matches/matchEffecten";
import { MATCH_DONE } from "@/test/fixtures";
import type { Match } from "@/types";

// De effectvlaggen achter de kaartachtergrond (#1151). Het punt van deze module
// is dat effecten onafhankelijke lagen zijn: alle acht de combinaties moeten
// bestaan zonder dat er ergens een combinatie-tak in de code staat.

const KAAL = { ...MATCH_DONE, wager_drink: null } as unknown as Match;
const MET_DRANKJE = {
  ...MATCH_DONE,
  wager_drink: "duvel",
  wager_drink_qty: 2,
} as unknown as Match;

const LEF_REGEL = "🎲 lef ×2 · Carol — verlies";
const JOKER_REGEL = "🃏 Bob — 🛡️ Schild, winst";

describe("matchEffecten — de acht combinaties (#1151)", () => {
  const gevallen: [string, Partial<Parameters<typeof matchEffecten>[0]>, boolean[]][] = [
    ["niets", { match: KAAL }, [false, false, false]],
    ["alleen lef", { match: KAAL, lef: LEF_REGEL }, [true, false, false]],
    ["alleen joker", { match: KAAL, joker: JOKER_REGEL }, [false, true, false]],
    ["alleen inzet", { match: MET_DRANKJE }, [false, false, true]],
    [
      "lef + joker",
      { match: KAAL, lef: LEF_REGEL, joker: JOKER_REGEL },
      [true, true, false],
    ],
    ["lef + inzet", { match: MET_DRANKJE, lef: LEF_REGEL }, [true, false, true]],
    [
      "joker + inzet",
      { match: MET_DRANKJE, joker: JOKER_REGEL },
      [false, true, true],
    ],
    [
      "lef + joker + inzet",
      { match: MET_DRANKJE, lef: LEF_REGEL, joker: JOKER_REGEL },
      [true, true, true],
    ],
  ];

  it.each(gevallen)("%s", (_naam, opts, [lef, joker, inzet]) => {
    expect(matchEffecten(opts as Parameters<typeof matchEffecten>[0])).toEqual({
      lef,
      joker,
      inzet,
    });
  });

  it("laat een kale match gelijk zijn aan GEEN_EFFECTEN", () => {
    expect(matchEffecten({ match: KAAL })).toEqual(GEEN_EFFECTEN);
    expect(heeftEffect(GEEN_EFFECTEN)).toBe(false);
  });

  it("meldt elk los effect via heeftEffect", () => {
    expect(heeftEffect(matchEffecten({ match: KAAL, lef: LEF_REGEL }))).toBe(true);
    expect(heeftEffect(matchEffecten({ match: KAAL, joker: JOKER_REGEL }))).toBe(
      true,
    );
    expect(heeftEffect(matchEffecten({ match: MET_DRANKJE }))).toBe(true);
  });
});

describe("matchEffecten — de onthullingspoort", () => {
  // De kern van #1151: lefGestart() en zichtbareJokers() houden vóór de aftrap
  // verborgen wie er dubbel of niets speelde. Zou de swirl rechtstreeks aan
  // match_stakes hangen, dan kleurde de kaart paars terwijl de regel wegbleef —
  // en lag de inzet alsnog open. Geen regel is daarom geen kleur.
  it("kleurt niets zolang de regel nog verborgen is", () => {
    const fx = matchEffecten({ match: KAAL, lef: null, joker: null });
    expect(fx.lef).toBe(false);
    expect(fx.joker).toBe(false);
  });

  it("behandelt een lege regel als geen regel", () => {
    expect(matchEffecten({ match: KAAL, lef: "", joker: "" })).toEqual(
      GEEN_EFFECTEN,
    );
  });
});

describe("matchEffecten — een vervallen inzet dooft", () => {
  it("laat een afgelaste match droog", () => {
    const m = { ...MET_DRANKJE, status: "cancelled" } as unknown as Match;
    expect(matchEffecten({ match: m }).inzet).toBe(false);
  });

  it("laat een gelijkspel droog", () => {
    const m = { ...MET_DRANKJE, winner_team_id: null } as unknown as Match;
    expect(matchEffecten({ match: m }).inzet).toBe(false);
  });

  it("houdt een ingeloste traktatie wél gekleurd — dat is opschepmateriaal", () => {
    const m = {
      ...MET_DRANKJE,
      wager_settled_at: MATCH_DONE.played_at,
    } as unknown as Match;
    expect(matchEffecten({ match: m }).inzet).toBe(true);
  });

  it("houdt een openstaande rekening op een geplande match gekleurd", () => {
    const m = {
      ...MET_DRANKJE,
      status: "scheduled",
      winner_team_id: null,
      score_a: null,
      score_b: null,
    } as unknown as Match;
    expect(matchEffecten({ match: m }).inzet).toBe(true);
  });
});
