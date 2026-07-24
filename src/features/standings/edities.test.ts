import { describe, it, expect } from "vitest";
import {
  EDITIE_PRIORITEIT,
  editieLabel,
  editieVoor,
  iconKeyVoor,
  type EditieContext,
} from "./edities";
import type { PlayerRating, PlayerStanding } from "@/types";

const standing = (
  player_id: string,
  points = 0,
  extra: Partial<PlayerStanding> = {},
): PlayerStanding =>
  ({
    player_id,
    username: player_id,
    full_name: null,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points,
    goal_diff: 0,
    ...extra,
  }) as PlayerStanding;

const ratingsFor = (per: Record<string, number>): Record<string, PlayerRating> =>
  Object.fromEntries(
    Object.entries(per).map(([id, rating]) => [
      id,
      { player_id: id, rating, games: 10, updated_at: "" } as PlayerRating,
    ]),
  );

const ctx = (over: Partial<EditieContext> = {}): EditieContext => ({
  dictatorId: null,
  iconKey: null,
  kampioen: null,
  inForm: null,
  onFire: {},
  pias: null,
  piet: null,
  ...over,
});

const inForm = { playerId: "p2", delta: 48, matches: 3 };
const kampioen = { playerId: "p3", seasonLabel: "Q2 2026" };
const pias = {
  isoYear: 2026,
  isoWeek: 30,
  weekStart: "2026-07-20",
  playerId: "p4",
  reden: "choke" as const,
  ernst: 39,
  waarde: 0.87,
  winChance: 0.87,
  beschermd: false,
};
const piet = {
  playerId: "p6",
  reden: "zwarte-reeks" as const,
  ernst: 45,
  detail: "verloor 5× op rij",
  since: "2026-07-14",
  beschermd: false,
};

describe("editieVoor (#497/#625) — prioriteitsmodel", () => {
  it("kent elke editie toe aan zijn drager", () => {
    const c = ctx({
      iconKey: "p1",
      kampioen,
      inForm,
      onFire: { p5: 6 },
      pias,
      piet,
    });
    expect(editieVoor("p1", c)).toBe("icon");
    expect(editieVoor("p3", c)).toBe("kampioen");
    expect(editieVoor("p2", c)).toBe("inform");
    expect(editieVoor("p5", c)).toBe("onfire");
    expect(editieVoor("p4", c)).toBe("pias");
    expect(editieVoor("p6", c)).toBe("piet");
    expect(editieVoor("p9", c)).toBeNull();
  });

  it("volgt de prioriteit: icon > kampioen > inform > onfire > pias > piet, voor álle varianten", () => {
    // Eén speler die alles tegelijk verdient (én verpest): de lijst beslist.
    const alles = ctx({
      iconKey: "p1",
      kampioen: { playerId: "p1", seasonLabel: "Q2 2026" },
      inForm: { ...inForm, playerId: "p1" },
      onFire: { p1: 6 },
      pias: { ...pias, playerId: "p1" },
      piet: { ...piet, playerId: "p1" },
    });
    expect(editieVoor("p1", alles)).toBe(EDITIE_PRIORITEIT[0]);
    // Zonder icon wint kampioen; daarna inform; dan onfire (de weeklens wint
    // van de reeks, #632); de pias sluit de rij — een schand-editie
    // verdringt nooit een verdiende (#631).
    expect(
      editieVoor("p1", { ...alles, iconKey: null }),
    ).toBe("kampioen");
    expect(
      editieVoor("p1", { ...alles, iconKey: null, kampioen: null }),
    ).toBe("inform");
    expect(
      editieVoor("p1", {
        ...alles,
        iconKey: null,
        kampioen: null,
        inForm: null,
      }),
    ).toBe("onfire");
    expect(
      editieVoor("p1", {
        ...alles,
        iconKey: null,
        kampioen: null,
        inForm: null,
        onFire: {},
      }),
    ).toBe("pias");
    // Binnen de schande wint de pias (weeklens) van de Piet (token, #645).
    expect(
      editieVoor("p1", {
        ...alles,
        iconKey: null,
        kampioen: null,
        inForm: null,
        onFire: {},
        pias: null,
      }),
    ).toBe("piet");
  });

  it("kan meerdere On-Fire-dragers tegelijk hebben (#632)", () => {
    const c = ctx({ onFire: { p1: 5, p2: 9 } });
    expect(editieVoor("p1", c)).toBe("onfire");
    expect(editieVoor("p2", c)).toBe("onfire");
    expect(editieVoor("p3", c)).toBeNull();
  });

  it("geeft de zittende dictator nooit een editie (troonkaart is genoeg)", () => {
    const c = ctx({
      dictatorId: "p1",
      iconKey: "p1",
      kampioen: { playerId: "p1", seasonLabel: "Q2 2026" },
      inForm: { ...inForm, playerId: "p1" },
      onFire: { p1: 8 },
      pias: { ...pias, playerId: "p1" },
    });
    expect(editieVoor("p1", c)).toBeNull();
    // Andere spelers houden hun editie gewoon.
    expect(editieVoor("p2", ctx({ dictatorId: "p1", inForm }))).toBe("inform");
  });

  it("zwijgt bij een roast-schild: geen pias-editie én niemand schuift door (#631)", () => {
    const c = ctx({ pias: { ...pias, beschermd: true } });
    expect(editieVoor("p4", c)).toBeNull();
    // De beschermde pias blijft de pias — er is geen vervangende drager.
    for (const key of ["p1", "p2", "p3", "p9"]) {
      expect(editieVoor(key, c)).toBeNull();
    }
  });

  it("zwijgt óók bij een roast-schild op de Piet — zelfde gedrag (#645)", () => {
    const c = ctx({ piet: { ...piet, beschermd: true } });
    expect(editieVoor("p6", c)).toBeNull();
    // De beschermde Piet blijft de Piet — er is geen vervangende drager.
    for (const key of ["p1", "p2", "p3", "p9"]) {
      expect(editieVoor(key, c)).toBeNull();
    }
  });
});

describe("editieLabel (#497/#625)", () => {
  it("maakt de editie-regel voor op het kaartvlak", () => {
    expect(editieLabel("icon", ctx())).toBe("👑 Big Daddy");
    expect(editieLabel("kampioen", ctx({ kampioen }))).toBe(
      "🏆 Kampioen Q2 2026",
    );
    expect(editieLabel("inform", ctx({ inForm }))).toBe("⚡ In-Form · +48");
    expect(editieLabel("onfire", ctx({ onFire: { p5: 6 } }), "p5")).toBe(
      "🔥 On Fire · 6 op rij",
    );
    expect(editieLabel("pias", ctx({ pias }))).toBe("🤡 Pias · 87%");
    // De Piet draagt zijn sinds-datum als reden-specifiek getal (#645).
    expect(editieLabel("piet", ctx({ piet }))).toBe(
      "🃏 Zwarte Piet · sinds 14/7",
    );
    expect(editieLabel(null, ctx({ inForm }))).toBeNull();
  });

  it("vat elke pias-reden compact samen op het kaartvlak (#643/#654)", () => {
    const met = (reden: "bagel" | "afdroging" | "zwarte-reeks", waarde: number) =>
      ctx({ pias: { ...pias, reden, waarde, winChance: null } });
    expect(editieLabel("pias", met("bagel", 1))).toBe("🤡 Pias · 🥯");
    expect(editieLabel("pias", met("bagel", 2))).toBe("🤡 Pias · 2× 🥯");
    expect(editieLabel("pias", met("afdroging", 5))).toBe("🤡 Pias · −5 games");
    expect(editieLabel("pias", met("zwarte-reeks", 3))).toBe(
      "🤡 Pias · 3× op rij",
    );
    // De realistisch langste waarden per reden (#654): ook dubbelcijferig en
    // een bijna-zekere choke blijven binnen de breedte van de kleinste kaart.
    expect(editieLabel("pias", met("afdroging", 12))).toBe(
      "🤡 Pias · −12 games",
    );
    expect(editieLabel("pias", met("zwarte-reeks", 12))).toBe(
      "🤡 Pias · 12× op rij",
    );
    expect(
      editieLabel("pias", ctx({ pias: { ...pias, waarde: 0.99, winChance: 0.99 } })),
    ).toBe("🤡 Pias · 99%");
  });

  it("valt defensief terug zonder contextdata", () => {
    expect(editieLabel("kampioen", ctx())).toBe("🏆 Kampioen");
    expect(editieLabel("inform", ctx())).toBe("⚡ In-Form");
    // Zonder key (of zonder reeks in de context) blijft het kale label over.
    expect(editieLabel("onfire", ctx({ onFire: { p5: 6 } }))).toBe("🔥 On Fire");
    expect(editieLabel("onfire", ctx(), "p5")).toBe("🔥 On Fire");
    expect(editieLabel("pias", ctx())).toBe("🤡 Pias van de club");
    expect(editieLabel("piet", ctx())).toBe("🃏 Zwarte Piet");
  });
});

describe("iconKeyVoor (#621) — zelfde Big Daddy op klassement, profiel en veld", () => {
  const stand = [standing("p1", 9), standing("p2", 6), standing("p3", 3)];

  it("kiest de hoogst-geratete speler wanneer niemand op De Troon zit", () => {
    const ratings = ratingsFor({ p1: 1100, p2: 1250, p3: 1000 });
    expect(iconKeyVoor(stand, ratings, null)).toBe("p2");
  });

  it("geeft geen kroon zolang een échte dictator in de stand staat", () => {
    const ratings = ratingsFor({ p1: 1100, p2: 1250, p3: 1000 });
    expect(iconKeyVoor(stand, ratings, "p2")).toBeNull();
    expect(iconKeyVoor(stand, ratings, "p1")).toBeNull();
  });

  it("laat de kroon staan als de dictator niet (meer) in de stand staat", () => {
    // Zelfde gedrag als splitDictatorThrone: dictator buiten de lijst → het
    // podium houdt zijn Big Daddy.
    const ratings = ratingsFor({ p1: 1100, p2: 1250, p3: 1000 });
    expect(iconKeyVoor(stand, ratings, "px")).toBe("p2");
  });

  it("breekt gelijke ratings met de klassieke punten-tie-break", () => {
    const ratings = ratingsFor({ p1: 1200, p2: 1200, p3: 1000 });
    // p1 heeft meer punten dan p2 → p1 draagt de kroon.
    expect(iconKeyVoor(stand, ratings, null)).toBe("p1");
  });

  it("geeft null zonder spelers of zonder rating voor de #1", () => {
    expect(iconKeyVoor([], {}, null)).toBeNull();
    expect(iconKeyVoor(stand, {}, null)).toBeNull();
  });
});
