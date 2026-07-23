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
  pias: null,
  ...over,
});

const inForm = { playerId: "p2", delta: 48, matches: 3 };
const kampioen = { playerId: "p3", seasonLabel: "Q2 2026" };
const pias = {
  isoYear: 2026,
  isoWeek: 30,
  weekStart: "2026-07-20",
  playerId: "p4",
  winChance: 0.87,
  beschermd: false,
};

describe("editieVoor (#497/#625) — prioriteitsmodel", () => {
  it("kent elke editie toe aan zijn drager", () => {
    const c = ctx({ iconKey: "p1", kampioen, inForm, pias });
    expect(editieVoor("p1", c)).toBe("icon");
    expect(editieVoor("p3", c)).toBe("kampioen");
    expect(editieVoor("p2", c)).toBe("inform");
    expect(editieVoor("p4", c)).toBe("pias");
    expect(editieVoor("p9", c)).toBeNull();
  });

  it("volgt de prioriteit: icon > kampioen > inform > pias, voor álle varianten", () => {
    // Eén speler die alles tegelijk verdient (én verpest): de lijst beslist.
    const alles = ctx({
      iconKey: "p1",
      kampioen: { playerId: "p1", seasonLabel: "Q2 2026" },
      inForm: { ...inForm, playerId: "p1" },
      pias: { ...pias, playerId: "p1" },
    });
    expect(editieVoor("p1", alles)).toBe(EDITIE_PRIORITEIT[0]);
    // Zonder icon wint kampioen; daarna inform; de pias sluit de rij — een
    // schand-editie verdringt nooit een verdiende (#631).
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
    ).toBe("pias");
  });

  it("geeft de zittende dictator nooit een editie (troonkaart is genoeg)", () => {
    const c = ctx({
      dictatorId: "p1",
      iconKey: "p1",
      kampioen: { playerId: "p1", seasonLabel: "Q2 2026" },
      inForm: { ...inForm, playerId: "p1" },
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
});

describe("editieLabel (#497/#625)", () => {
  it("maakt de editie-regel voor op het kaartvlak", () => {
    expect(editieLabel("icon", ctx())).toBe("👑 Big Daddy");
    expect(editieLabel("kampioen", ctx({ kampioen }))).toBe(
      "🏆 Kampioen Q2 2026",
    );
    expect(editieLabel("inform", ctx({ inForm }))).toBe("⚡ In-Form · +48");
    expect(editieLabel("pias", ctx({ pias }))).toBe(
      "🤡 Pias van de week · 87%",
    );
    expect(editieLabel(null, ctx({ inForm }))).toBeNull();
  });

  it("valt defensief terug zonder contextdata", () => {
    expect(editieLabel("kampioen", ctx())).toBe("🏆 Kampioen");
    expect(editieLabel("inform", ctx())).toBe("⚡ In-Form");
    expect(editieLabel("pias", ctx())).toBe("🤡 Pias van de week");
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
