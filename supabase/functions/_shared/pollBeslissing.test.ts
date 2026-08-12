import { describe, expect, it } from "vitest";
import { haaltDrempel, kiesMoment, MIN_SPELERS } from "./pollBeslissing.ts";
import type { MomentTelling } from "./pollBeslissing.ts";
// De client-tegenhanger: dezelfde drempel, andere boom.
import { PLAYERS_PER_COURT } from "@/features/groups/pollLogic";

const moment = (over: Partial<MomentTelling> = {}): MomentTelling => ({
  optionId: "a",
  ja: 0,
  misschien: 0,
  courtsFree: null,
  startMs: Date.parse("2026-08-20T18:00:00Z"),
  ...over,
});

describe("MIN_SPELERS", () => {
  it("blijft gelijk aan de drempel die de app toont", () => {
    expect(MIN_SPELERS).toBe(PLAYERS_PER_COURT);
  });
});

describe("haaltDrempel", () => {
  it("telt ja en misschien bij elkaar op", () => {
    expect(haaltDrempel(moment({ ja: 3 }))).toBe(false);
    expect(haaltDrempel(moment({ ja: 2, misschien: 2 }))).toBe(true);
    expect(haaltDrempel(moment({ misschien: 4 }))).toBe(true);
  });
});

describe("kiesMoment", () => {
  it("annuleert onder de drempel — ook met ja-stemmen", () => {
    expect(kiesMoment([moment({ ja: 3 })])).toBeNull();
    expect(kiesMoment([moment({ ja: 1, misschien: 1 })])).toBeNull();
  });

  it("legt vast zodra ja plus misschien er vier zijn", () => {
    const gekozen = kiesMoment([moment({ ja: 2, misschien: 2 })]);
    expect(gekozen?.optionId).toBe("a");
  });

  it("kiest op ja-stemmen, niet op het totaal", () => {
    // b heeft meer volk (6), maar a heeft de meeste harde ja's.
    const a = moment({ optionId: "a", ja: 5 });
    const b = moment({ optionId: "b", ja: 2, misschien: 4 });
    expect(kiesMoment([a, b])?.optionId).toBe("a");
    expect(kiesMoment([b, a])?.optionId).toBe("a");
  });

  it("laat bij gelijk aantal ja het vroegste moment winnen", () => {
    const laat = moment({
      optionId: "laat",
      ja: 4,
      startMs: Date.parse("2026-08-21T18:00:00Z"),
    });
    const vroeg = moment({
      optionId: "vroeg",
      ja: 4,
      startMs: Date.parse("2026-08-20T18:00:00Z"),
    });
    expect(kiesMoment([laat, vroeg])?.optionId).toBe("vroeg");
    expect(kiesMoment([vroeg, laat])?.optionId).toBe("vroeg");
  });

  it("laat een moment vallen waarvoor te weinig baan vrij is", () => {
    // Negen ja-stemmers vragen drie banen; er is er één vrij.
    expect(kiesMoment([moment({ ja: 9, courtsFree: 1 })])).toBeNull();
    // Onbekende beschikbaarheid telt als haalbaar.
    expect(kiesMoment([moment({ ja: 9, courtsFree: null })])?.optionId).toBe("a");
  });

  it("valt terug op het moment dat wél een baan heeft", () => {
    const vol = moment({ optionId: "vol", ja: 8, courtsFree: 1 });
    const vrij = moment({ optionId: "vrij", ja: 4, courtsFree: 1 });
    expect(kiesMoment([vol, vrij])?.optionId).toBe("vrij");
  });

  it("geeft null zonder momenten", () => {
    expect(kiesMoment([])).toBeNull();
  });
});
