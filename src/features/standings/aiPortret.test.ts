import { describe, it, expect } from "vitest";
import {
  GEEN_AVATAR_BRON,
  portretVervallen,
  portretVoor,
} from "./aiPortret";

// Verhuisd uit dictatorPortret.test.ts (#554) toen de pias dezelfde helpers ging
// gebruiken (#682); elke test staat er nu voor béide soorten.

describe("portretVervallen (#554/#682)", () => {
  it("geen portret → vervallen", () => {
    expect(
      portretVervallen({ avatar_url: "a.png", dictator_avatar_url: null }, "dictator"),
    ).toBe(true);
    expect(
      portretVervallen({ avatar_url: "a.png", pias_avatar_url: null }, "pias"),
    ).toBe(true);
  });

  it("bron matcht de huidige foto → niet vervallen", () => {
    expect(
      portretVervallen(
        {
          avatar_url: "a.png",
          dictator_avatar_url: "p.png",
          dictator_avatar_bron: "a.png",
        },
        "dictator",
      ),
    ).toBe(false);
    expect(
      portretVervallen(
        { avatar_url: "a.png", pias_avatar_url: "c.png", pias_avatar_bron: "a.png" },
        "pias",
      ),
    ).toBe(false);
  });

  it("fotowissel (bron ≠ huidige foto) → vervallen", () => {
    expect(
      portretVervallen(
        {
          avatar_url: "nieuw.png",
          dictator_avatar_url: "p.png",
          dictator_avatar_bron: "oud.png",
        },
        "dictator",
      ),
    ).toBe(true);
    expect(
      portretVervallen(
        {
          avatar_url: "nieuw.png",
          pias_avatar_url: "c.png",
          pias_avatar_bron: "oud.png",
        },
        "pias",
      ),
    ).toBe(true);
  });

  it("geen avatar: sentinel-bron telt als geldig", () => {
    expect(
      portretVervallen(
        {
          avatar_url: null,
          dictator_avatar_url: "p.png",
          dictator_avatar_bron: GEEN_AVATAR_BRON,
        },
        "dictator",
      ),
    ).toBe(false);
    expect(
      portretVervallen(
        {
          avatar_url: null,
          pias_avatar_url: "c.png",
          pias_avatar_bron: GEEN_AVATAR_BRON,
        },
        "pias",
      ),
    ).toBe(false);
  });

  it("kijkt per soort naar de eigen kolommen", () => {
    // Een klaar dictator-portret zegt niets over het clownportret.
    const p = {
      avatar_url: "a.png",
      dictator_avatar_url: "p.png",
      dictator_avatar_bron: "a.png",
    };
    expect(portretVervallen(p, "dictator")).toBe(false);
    expect(portretVervallen(p, "pias")).toBe(true);
  });
});

describe("portretVoor (#682)", () => {
  it("geeft het portret als het er is", () => {
    expect(
      portretVoor({ pias_avatar_url: "c.png", pias_portret: true }, "pias"),
    ).toBe("c.png");
  });

  it("zwijgt bij een opt-out, ook als er nog een portret bewaard staat", () => {
    // De #682-migratie nult zo'n URL, maar de UI mag er niet op vertrouwen dat
    // dat overal al gebeurd is.
    expect(
      portretVoor({ pias_avatar_url: "c.png", pias_portret: false }, "pias"),
    ).toBeNull();
    expect(
      portretVoor(
        { dictator_avatar_url: "p.png", dictator_portret: false },
        "dictator",
      ),
    ).toBeNull();
  });

  it("ontbrekende opt-out-vlag telt als aan (bestaand gedrag)", () => {
    expect(portretVoor({ pias_avatar_url: "c.png" }, "pias")).toBe("c.png");
  });

  it("null zonder profiel of zonder portret", () => {
    expect(portretVoor(null, "pias")).toBeNull();
    expect(portretVoor({}, "pias")).toBeNull();
  });
});
