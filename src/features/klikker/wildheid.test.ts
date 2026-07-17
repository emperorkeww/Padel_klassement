import { describe, it, expect } from "vitest";
import { wildheid, WILD_ALPHA, WILD_VOL_BIJ } from "@/features/klikker/wildheid";

describe("wildheid", () => {
  it("blijft 0 bij stilstand", () => {
    expect(wildheid(0, 16, 0)).toBe(0);
  });

  it("zakt terug richting 0 als het tekenen stilvalt", () => {
    let w = 0.8;
    for (let i = 0; i < 20; i++) w = wildheid(0, 16, w);
    expect(w).toBeLessThan(0.01);
  });

  it("stijgt sneller bij wilder tekenen", () => {
    const rustig = wildheid(8, 16, 0); // 0,5 px/ms
    const wild = wildheid(24, 16, 0); // 1,5 px/ms
    expect(wild).toBeGreaterThan(rustig);
  });

  it("clampt het doel op 1, ook bij extreme snelheid", () => {
    let w = 0;
    for (let i = 0; i < 100; i++) w = wildheid(1000, 1, w);
    expect(w).toBeLessThanOrEqual(1);
    expect(w).toBeGreaterThan(0.99);
  });

  it("smootht met alpha: één stap dekt precies alpha van de afstand", () => {
    // Vol-snelheid vanaf 0 → doel 1, dus de uitkomst is exact alpha.
    expect(wildheid(WILD_VOL_BIJ * 16, 16, 0)).toBeCloseTo(WILD_ALPHA);
  });

  it("negeert dt van 0 (geen deling door nul)", () => {
    expect(wildheid(50, 0, 0.4)).toBeCloseTo(0.4 * (1 - WILD_ALPHA));
  });
});
