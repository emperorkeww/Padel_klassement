import { describe, it, expect } from "vitest";
import {
  SECTIES,
  SECTIE_IDS,
  UITLEG_PAD,
  sectieHref,
  uitlegAnker,
  uitlegHref,
  type SectieId,
} from "./secties";

describe("SECTIES", () => {
  it("heeft unieke id's", () => {
    expect(new Set(SECTIE_IDS).size).toBe(SECTIES.length);
  });

  it("vult elke sectie volledig", () => {
    for (const s of SECTIES) {
      expect(s.titel.length, s.id).toBeGreaterThan(0);
      expect(s.emoji.length, s.id).toBeGreaterThan(0);
      expect(s.samenvatting.length, s.id).toBeGreaterThan(0);
    }
  });

  it("dekt alle vijftien secties uit #989", () => {
    expect(SECTIES).toHaveLength(15);
  });
});

describe("uitlegAnker", () => {
  it("stuurt het overzicht naar 'aan de slag' — daar landt een nieuwkomer", () => {
    expect(uitlegAnker("/")).toBe("aan-de-slag");
  });

  it.each<[string, SectieId]>([
    ["/klassement", "rating"],
    ["/banen", "banen"],
    ["/matches", "uitslagen"],
    ["/spelen", "speeldag"],
    ["/groepen", "speeldag"],
    ["/feed", "feed"],
    ["/vrienden", "feed"],
    ["/profiel", "privacy"],
    ["/spelers", "kaarten"],
  ])("mapt %s op #%s", (pad, id) => {
    expect(uitlegAnker(pad)).toBe(id);
  });

  it("matcht op prefix, zodat detailroutes bij hun sectie blijven", () => {
    expect(uitlegAnker("/groepen/abc-123")).toBe("speeldag");
    expect(uitlegAnker("/matches/42")).toBe("uitslagen");
    expect(uitlegAnker("/spelers/xyz")).toBe("kaarten");
  });

  it("laat de pagina zelf en onbekende paden bovenaan openen", () => {
    expect(uitlegAnker(UITLEG_PAD)).toBeNull();
    expect(uitlegAnker("/iets-nieuws")).toBeNull();
  });

  it("verwart geen pad dat toevallig zo begint", () => {
    // /banenverhuur is geen /banen; alleen een exacte match of een echt
    // subpad telt.
    expect(uitlegAnker("/banenverhuur")).toBeNull();
  });

  it("verwijst alleen naar bestaande secties", () => {
    const paden = ["/", "/klassement", "/banen", "/matches", "/spelen", "/groepen", "/feed", "/vrienden", "/profiel", "/spelers"];
    for (const pad of paden) {
      const id = uitlegAnker(pad);
      expect(SECTIE_IDS, pad).toContain(id);
    }
  });
});

describe("uitlegHref / sectieHref", () => {
  it("hangt het anker aan de route", () => {
    expect(uitlegHref("/klassement")).toBe("/uitleg#rating");
    expect(sectieHref("toto")).toBe("/uitleg#toto");
  });

  it("laat de hash weg als er geen passende sectie is", () => {
    expect(uitlegHref("/iets-nieuws")).toBe("/uitleg");
  });
});
