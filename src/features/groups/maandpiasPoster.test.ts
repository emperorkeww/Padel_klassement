import { describe, it, expect } from "vitest";
import {
  piasPoster,
  piasOnderschrift,
  piasCoachQuote,
} from "@/features/groups/maandpiasPoster";
import { SNEER } from "@/features/coach/roastTone";

describe("piasPoster", () => {
  it("zet de maand-kop bij scope 'maand'", () => {
    const p = piasPoster("Tom", "kreeg een 6-0 om de oren 💔", "januari 2026", "maand");
    expect(p.kop).toBe("PIAS VAN DE MAAND");
    expect(p.naam).toBe("Tom");
    expect(p.detail).toContain("6-0");
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

describe("piasCoachQuote", () => {
  it("quote met naam, mic en een sneer uit de pool (#202)", () => {
    const quote = piasCoachQuote({ intensiteit: "gemeen", schild: false }, 42);
    expect(quote).toContain("🎙️");
    expect(quote).toContain("Coach Rudy:");
    expect(SNEER.gemeen.some((s) => quote!.includes(s))).toBe(true);
  });

  it("is deterministisch bij gelijke seed", () => {
    const ctx = { intensiteit: "radioactief", schild: false } as const;
    expect(piasCoachQuote(ctx, 7)).toBe(piasCoachQuote(ctx, 7));
  });

  it("zwijgt bij roast-schild", () => {
    expect(piasCoachQuote({ intensiteit: "gemeen", schild: true }, 42)).toBeNull();
  });
});
