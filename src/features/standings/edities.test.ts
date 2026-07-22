import { describe, it, expect } from "vitest";
import { editieLabel, editieVoor, iconKeyVoor } from "./edities";
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

describe("editieVoor / editieLabel (#497)", () => {
  const inForm = { playerId: "p2", delta: 48, matches: 3 };

  it("Icon wint van In-Form; anderen krijgen geen editie", () => {
    expect(editieVoor("p1", "p1", inForm)).toBe("icon");
    expect(editieVoor("p2", "p2", inForm)).toBe("icon");
    expect(editieVoor("p2", "p1", inForm)).toBe("inform");
    expect(editieVoor("p3", "p1", inForm)).toBeNull();
  });

  it("maakt de editie-regel voor op het kaartvlak", () => {
    expect(editieLabel("icon", null)).toBe("👑 Big Daddy");
    expect(editieLabel("inform", inForm)).toBe("⚡ In-Form · +48");
    expect(editieLabel(null, inForm)).toBeNull();
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
