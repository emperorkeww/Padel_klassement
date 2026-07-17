import { describe, it, expect } from "vitest";
import {
  ERAF,
  ERIN,
  MINUTEN,
  POSITIES,
  genereerWissel,
  leegGebruikt,
} from "@/features/klikker/wisselGenerator";

describe("genereerWissel", () => {
  it("is deterministisch op de seed (met verse sets)", () => {
    expect(genereerWissel(42, leegGebruikt())).toEqual(genereerWissel(42, leegGebruikt()));
  });

  it("bouwt de zin uit alle vier de fragmenten", () => {
    const w = genereerWissel(7, leegGebruikt());
    expect(w.zin).toBe(`Wissel in minuut ${w.minuut}: ${w.eraf} eraf, ${w.erin} erin, ${w.positie}.`);
    expect(MINUTEN).toContain(w.minuut);
    expect(ERAF).toContain(w.eraf);
    expect(ERIN).toContain(w.erin);
    expect(POSITIES).toContain(w.positie);
  });

  it("herhaalt nooit direct de vorige zin, ook met constante seed", () => {
    const gebruikt = leegGebruikt();
    let vorige: string | undefined;
    for (let i = 0; i < 200; i++) {
      const w = genereerWissel(5, gebruikt, vorige);
      expect(w.zin).not.toBe(vorige);
      vorige = w.zin;
    }
  });

  it("laat elk fragment van een pool voorbijkomen vóór er één herhaalt", () => {
    const gebruikt = leegGebruikt();
    const gezien = new Set<string>();
    let vorige: string | undefined;
    // De kleinste pools hebben 10 items: binnen 10 trekkingen géén dubbele
    // minuut/eraf/positie (kiesUniek + gebruikt-set).
    for (let i = 0; i < MINUTEN.length; i++) {
      const w = genereerWissel(1000 + i, gebruikt, vorige);
      expect(gezien.has(w.minuut)).toBe(false);
      gezien.add(w.minuut);
      vorige = w.zin;
    }
    expect(gezien.size).toBe(MINUTEN.length);
  });

  it("blijft variëren nadat een pool is uitgeput (set wordt geleegd)", () => {
    const gebruikt = leegGebruikt();
    let vorige: string | undefined;
    const zinnen = new Set<string>();
    for (let i = 0; i < 3 * MINUTEN.length; i++) {
      const w = genereerWissel(i, gebruikt, vorige);
      zinnen.add(w.zin);
      vorige = w.zin;
    }
    // Ruim meer unieke zinnen dan één pool-lengte: de generator loopt niet vast.
    expect(zinnen.size).toBeGreaterThan(MINUTEN.length);
  });
});
