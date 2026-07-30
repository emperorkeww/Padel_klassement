import { describe, expect, it } from "vitest";
import * as roast from "./roast.ts";
import { afdrogingLabel, kiesTitel, kiesUit, rangOvergang, roastSeed } from "./roast.ts";

/** Alle tekstpools uit de module, plat met hun pad ("PIAS_SNEER.mild"). Zo
 *  bewaakt deze test ook pools die later worden toegevoegd, zonder bijwerken. */
function pools(): [string, readonly string[]][] {
  const uit: [string, readonly string[]][] = [];
  const loop = (waarde: unknown, pad: string) => {
    if (Array.isArray(waarde)) {
      if (waarde.every((x) => typeof x === "string")) uit.push([pad, waarde]);
      return;
    }
    if (waarde && typeof waarde === "object") {
      for (const [k, v] of Object.entries(waarde)) loop(v, pad ? `${pad}.${k}` : k);
    }
  };
  for (const [naam, waarde] of Object.entries(roast)) loop(waarde, naam);
  return uit;
}

const isTitel = (pad: string) => pad.startsWith("TITEL_");

describe("tekstpools", () => {
  it("vindt alle pools (vangnet: een lege walker zou alles hieronder stilzwijgend laten slagen)", () => {
    const paden = pools().map(([pad]) => pad);
    expect(paden).toContain("PIAS_SNEER.mild");
    expect(paden).toContain("VERLIES_SNEER.radioactief");
    expect(paden).toContain("TITEL_SNEER");
    expect(paden.length).toBeGreaterThan(30);
  });

  it("heeft per pool genoeg keuze om niet te herhalen", () => {
    for (const [pad, pool] of pools()) {
      expect(pool.length, `${pad} is te klein voor variatie`).toBeGreaterThanOrEqual(4);
    }
  });

  it("bevat geen dubbele regels binnen één pool", () => {
    for (const [pad, pool] of pools()) {
      const dubbel = pool.filter((r, i) => pool.indexOf(r) !== i);
      expect(dubbel, `${pad} herhaalt zichzelf`).toEqual([]);
    }
  });

  it("houdt de regels kort genoeg voor een melding", () => {
    // Android/iOS kappen af: een titel rond de 40-50 tekens, de body ruimer.
    for (const [pad, pool] of pools()) {
      const max = isTitel(pad) ? 48 : 140;
      for (const regel of pool) {
        expect(regel.length, `${pad}: "${regel}"`).toBeLessThanOrEqual(max);
        expect(regel.trim(), `${pad}: witruimte aan de rand`).toBe(regel);
        expect(regel.length, `${pad}: lege regel`).toBeGreaterThan(0);
      }
    }
  });

  it("sluit elke body-regel af met een leesteken", () => {
    // De body's worden aan elkaar geplakt ("Om 20:00 sta je op de baan. <quip>"),
    // dus een ontbrekende punt valt meteen op in de melding.
    for (const [pad, pool] of pools()) {
      if (isTitel(pad)) continue;
      for (const regel of pool) {
        expect(regel, `${pad}: "${regel}"`).toMatch(/[.!?…]$/);
      }
    }
  });

  it("heeft voor elke roast-intensiteit een eigen pool", () => {
    for (const naam of ["PIAS_SNEER", "BAGEL_SNEER", "MONSTER_SNEER", "VERLIES_SNEER"]) {
      const pool = (roast as unknown as Record<string, Record<string, string[]>>)[naam];
      expect(Object.keys(pool).sort()).toEqual(["gemeen", "mild", "radioactief"]);
    }
  });
});

describe("kiesUit", () => {
  it("is deterministisch op de seed", () => {
    const pool = ["a", "b", "c"];
    const seed = roastSeed("match-1", "speler-1");
    expect(kiesUit(pool, seed)).toBe(kiesUit(pool, seed));
  });

  it("blijft binnen de pool, ook bij een negatieve seed", () => {
    const pool = ["a", "b", "c"];
    for (const seed of [-7, -1, 0, 1, 5381, 2 ** 31 - 1]) {
      expect(pool).toContain(kiesUit(pool, seed));
    }
  });

  it("spreidt over de hele pool", () => {
    const pool = ["a", "b", "c", "d", "e"];
    const gezien = new Set(
      Array.from({ length: 200 }, (_, i) => kiesUit(pool, roastSeed(`match-${i}`))),
    );
    expect(gezien.size).toBe(pool.length);
  });
});

describe("kiesTitel", () => {
  it("koppelt de titel niet aan de body-keuze", () => {
    // Zelfde delen, andere seed-tak: anders schuiven titel en body samen op en
    // krijg je altijd dezelfde vaste combinatie te zien.
    const delen = ["match-1", "speler-1"];
    expect(kiesTitel(["t1", "t2"], ...delen)).toBeTruthy();
    expect(roastSeed("titel", ...delen)).not.toBe(roastSeed(...delen));
  });

  it("varieert over gebeurtenissen", () => {
    const gezien = new Set(
      Array.from({ length: 100 }, (_, i) => kiesTitel(roast.TITEL_SNEER, `m-${i}`)),
    );
    expect(gezien.size).toBe(roast.TITEL_SNEER.length);
  });
});

describe("afdrogingLabel", () => {
  it("herkent een bagel, een monsterzege en een gewone uitslag", () => {
    expect(afdrogingLabel({ score_a: 6, score_b: 0 })).toBe("bagel");
    expect(afdrogingLabel({ score_a: 0, score_b: 6 })).toBe("bagel");
    expect(afdrogingLabel({ score_a: 6, score_b: 2 })).toBe("monsterzege");
    expect(afdrogingLabel({ score_a: 6, score_b: 3 })).toBeNull();
    expect(afdrogingLabel({ score_a: null, score_b: 3 })).toBeNull();
    // 0-0 is geen bagel maar een niet-gespeelde match.
    expect(afdrogingLabel({ score_a: 0, score_b: 0 })).toBeNull();
  });
});

describe("rangOvergang", () => {
  it("classificeert promotie en degradatie", () => {
    expect(rangOvergang("jager", "troon")).toEqual({
      richting: "promotie",
      event: "troon",
    });
    expect(rangOvergang("troon", "jager")).toEqual({
      richting: "degradatie",
      event: "troon_kwijt",
    });
    expect(rangOvergang("middenmoot", "kelder")).toEqual({
      richting: "degradatie",
      event: "kelder",
    });
    expect(rangOvergang("kelder", "middenmoot")).toEqual({
      richting: "promotie",
      event: "uit_kelder",
    });
  });

  it("zwijgt zonder echte overgang", () => {
    expect(rangOvergang("jager", "jager")).toBeNull();
    expect(rangOvergang("nieuw", "kelder")).toBeNull();
    expect(rangOvergang("troon", "nieuw")).toBeNull();
  });
});
