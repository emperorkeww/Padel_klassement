import { describe, expect, it } from "vitest";
import {
  GEEN_AVATAR,
  STIJLEN,
  bepaalAanroeppad,
  bronVoor,
  overslaanReden,
  promptVoor,
} from "./aiPortret.ts";

describe("bepaalAanroeppad (#682, fail-closed als #460)", () => {
  it("laat een client zonder cron-header naar het user-JWT-pad", () => {
    expect(bepaalAanroeppad(null, "geheim", undefined)).toEqual({ pad: "user" });
    // Ook een meegestuurde userId mag het user-pad niet omzeilen: die wordt
    // genegeerd, de JWT beslist.
    expect(bepaalAanroeppad(null, "geheim", "iemand-anders")).toEqual({
      pad: "user",
    });
  });

  it("vertrouwt de server-trigger bij een juist geheim", () => {
    expect(bepaalAanroeppad("geheim", "geheim", "u1")).toEqual({
      pad: "cron",
      userId: "u1",
    });
  });

  it("weigert een verkeerde header i.p.v. stil naar het user-pad te vallen", () => {
    // Zou dit terugvallen op pad 1, dan kreeg een aanvaller met een gokje geen
    // 401 maar het gedrag van een gewone client.
    expect(bepaalAanroeppad("fout", "geheim", "u1")).toEqual({
      pad: "weiger",
      status: 401,
      error: "Geen toegang",
    });
  });

  it("weigert als het geheim niet geconfigureerd is (#460)", () => {
    expect(bepaalAanroeppad("wat-dan-ook", undefined, "u1")).toMatchObject({
      pad: "weiger",
      status: 401,
    });
    expect(bepaalAanroeppad("", "", "u1")).toEqual({ pad: "user" });
  });

  it("vraagt om een userId op het cron-pad", () => {
    expect(bepaalAanroeppad("geheim", "geheim", undefined)).toEqual({
      pad: "weiger",
      status: 400,
      error: "userId vereist",
    });
  });
});

describe("bronVoor", () => {
  it("gebruikt de avatar-URL als bron", () => {
    expect(bronVoor("https://cdn/foto.png")).toBe("https://cdn/foto.png");
  });

  it("valt zonder foto terug op de sentinel, zodat een latere upload hergenereert", () => {
    expect(bronVoor(null)).toBe(GEEN_AVATAR);
    expect(bronVoor(undefined)).toBe(GEEN_AVATAR);
  });
});

describe("overslaanReden", () => {
  const stijl = STIJLEN.pias;
  const profiel = (over: Record<string, unknown> = {}) => ({
    avatar_url: "https://cdn/foto.png",
    is_guest: false,
    pias_portret: true,
    pias_avatar_url: null,
    pias_avatar_bron: null,
    ...over,
  });

  it("laat een gewoon profiel zonder portret door", () => {
    expect(overslaanReden(profiel(), stijl, "https://cdn/foto.png")).toBeNull();
  });

  it("slaat gasten over — geen account, geen eigen keuze", () => {
    expect(overslaanReden(profiel({ is_guest: true }), stijl, "x")).toEqual({
      reden: "guest",
    });
  });

  it("respecteert de opt-out: de foto gaat dan nooit naar OpenAI", () => {
    expect(
      overslaanReden(profiel({ pias_portret: false }), stijl, "x"),
    ).toEqual({ reden: "opt-out" });
  });

  it("is idempotent op de bron: hetzelfde portret wordt niet opnieuw gemaakt", () => {
    expect(
      overslaanReden(
        profiel({
          pias_avatar_url: "https://cdn/pias.png",
          pias_avatar_bron: "https://cdn/foto.png",
        }),
        stijl,
        "https://cdn/foto.png",
      ),
    ).toEqual({ reden: "cached", url: "https://cdn/pias.png" });
  });

  it("hergenereert na een fotowissel (bron wijkt af van de huidige foto)", () => {
    expect(
      overslaanReden(
        profiel({
          avatar_url: "https://cdn/foto-2.png",
          pias_avatar_url: "https://cdn/pias.png",
          pias_avatar_bron: "https://cdn/foto-1.png",
        }),
        stijl,
        "https://cdn/foto-2.png",
      ),
    ).toBeNull();
  });

  it("hergenereert als de bron klopt maar de URL ontbreekt (halve staat)", () => {
    expect(
      overslaanReden(
        profiel({ pias_avatar_url: null, pias_avatar_bron: "https://cdn/foto.png" }),
        stijl,
        "https://cdn/foto.png",
      ),
    ).toBeNull();
  });

  it("kijkt per stijl naar de eigen kolommen", () => {
    // Een klaar dictator-portret zegt niets over het pias-portret.
    const p = profiel({
      dictator_avatar_url: "https://cdn/dictator.png",
      dictator_avatar_bron: "https://cdn/foto.png",
    });
    expect(overslaanReden(p, STIJLEN.pias, "https://cdn/foto.png")).toBeNull();
    expect(
      overslaanReden(p, STIJLEN.dictator, "https://cdn/foto.png"),
    ).toEqual({ reden: "cached", url: "https://cdn/dictator.png" });
  });
});

describe("STIJLEN", () => {
  it("schrijft elke stijl naar een eigen bestand, kolommen en referentie", () => {
    const d = STIJLEN.dictator;
    const p = STIJLEN.pias;
    expect([d.bestand, d.urlKolom, d.bronKolom, d.optOutKolom, d.referentiePad])
      .not.toEqual([p.bestand, p.urlKolom, p.bronKolom, p.optOutKolom, p.referentiePad]);
    expect(p.bestand).toBe("pias.png");
    expect(p.optOutKolom).toBe("pias_portret");
  });

  it("houdt in beide prompts vast aan gelijkenis uit de EERSTE foto", () => {
    for (const stijl of [STIJLEN.dictator, STIJLEN.pias]) {
      expect(promptVoor(stijl, true)).toMatch(/FIRST image/);
      expect(promptVoor(stijl, true)).toMatch(/Do NOT copy the reference/);
      // Zonder eigen foto: expliciet een verzonnen, niet-identificeerbaar gezicht.
      expect(promptVoor(stijl, false)).toMatch(/COMPLETELY DIFFERENT, invented/);
      expect(promptVoor(stijl, false)).toMatch(/not a real public figure/);
    }
  });

  it("houdt de pias-prompt plagend i.p.v. vernederend", () => {
    expect(STIJLEN.pias.promptMetAvatar).toMatch(/never grotesque or humiliating/);
    expect(STIJLEN.pias.promptMetAvatar).toMatch(
      /do not exaggerate or distort their facial features/,
    );
  });
});
