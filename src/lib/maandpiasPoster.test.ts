import { describe, it, expect } from "vitest";
import { piasPoster, piasOnderschrift } from "./maandpiasPoster";

describe("piasPoster", () => {
  it("zet de maand-kop bij scope 'maand'", () => {
    const p = piasPoster("Tom", "slikte een bagel 🥯", "januari 2026", "maand");
    expect(p.kop).toBe("PIAS VAN DE MAAND");
    expect(p.naam).toBe("Tom");
    expect(p.detail).toContain("bagel");
    expect(p.periodeLabel).toBe("januari 2026");
  });

  it("zet de pias-alarm-kop bij scope 'week'", () => {
    const p = piasPoster("Ann", "verloor 3× op rij", "deze week", "week");
    expect(p.kop).toBe("PIAS-ALARM");
  });

  it("geeft per reden een onderschrift", () => {
    expect(piasOnderschrift("bagel")).toMatch(/games/i);
    expect(piasOnderschrift("afdroging")).toBeTruthy();
    expect(piasOnderschrift("zwarte-reeks")).toBeTruthy();
    expect(piasOnderschrift("choke")).toBeTruthy();
  });
});
