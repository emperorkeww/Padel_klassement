import { describe, it, expect } from "vitest";
import {
  AFGEWEZEN,
  NEUTRAAL,
  TEGOED_OP,
  TOEGEKEND_OMDRAAI,
  TOEGEKEND_ZONDER_GEVOLG,
  VERLOPEN,
  varMood,
  varPool,
  varUitspraak,
} from "@/features/coach/varUitspraak";
import type { RoastCtx } from "@/features/coach/roastTone";

const GEMEEN: RoastCtx = { intensiteit: "gemeen", schild: false };
const SCHILD: RoastCtx = { intensiteit: "gemeen", schild: true };

describe("varUitspraak", () => {
  it("kiest de omdraai-pool zodra de winnaar wisselt", () => {
    const zin = varUitspraak({
      appealId: "a1",
      status: "toegekend",
      winnaarDraaitOm: true,
      ctx: GEMEEN,
    });
    expect(TOEGEKEND_OMDRAAI).toContain(zin);
  });

  it("zegt er eerlijk bij dat het klassement niet beweegt", () => {
    const zin = varUitspraak({
      appealId: "a1",
      status: "toegekend",
      winnaarDraaitOm: false,
      ctx: GEMEEN,
    });
    expect(TOEGEKEND_ZONDER_GEVOLG).toContain(zin);
  });

  it("heeft eigen woorden voor een afwijzing, een vervallen zaak en een leeg tegoed", () => {
    expect(AFGEWEZEN).toContain(
      varUitspraak({ appealId: "a1", status: "afgewezen", ctx: GEMEEN }),
    );
    expect(VERLOPEN).toContain(
      varUitspraak({ appealId: "a1", status: "verlopen", ctx: GEMEEN }),
    );
    expect(TEGOED_OP).toContain(
      varUitspraak({ appealId: "a1", status: "tegoed-op", ctx: GEMEEN }),
    );
  });

  it("is deterministisch: de hele groep leest dezelfde uitspraak", () => {
    const eerste = varUitspraak({
      appealId: "a-42",
      status: "afgewezen",
      ctx: GEMEEN,
    });
    const tweede = varUitspraak({
      appealId: "a-42",
      status: "afgewezen",
      ctx: GEMEEN,
    });
    expect(tweede).toBe(eerste);
  });

  it("varieert wel tussen verschillende zaken", () => {
    const zinnen = new Set(
      ["a", "b", "c", "d", "e", "f"].map((id) =>
        varUitspraak({ appealId: id, status: "afgewezen", ctx: GEMEEN }),
      ),
    );
    expect(zinnen.size).toBeGreaterThan(1);
  });

  it("respecteert het roast-schild met een kale, feitelijke zin", () => {
    for (const status of [
      "toegekend",
      "afgewezen",
      "verlopen",
      "tegoed-op",
    ] as const) {
      expect(varUitspraak({ appealId: "a1", status, ctx: SCHILD })).toBe(
        NEUTRAAL[status],
      );
    }
  });

  it("vermijdt herhaling binnen één weergave", () => {
    const gebruikt = new Set<string>();
    const a = varUitspraak({
      appealId: "a1",
      status: "afgewezen",
      ctx: GEMEEN,
      gebruikt,
    });
    const b = varUitspraak({
      appealId: "a1",
      status: "afgewezen",
      ctx: GEMEEN,
      gebruikt,
    });
    expect(b).not.toBe(a);
  });
});

describe("varPool", () => {
  it("heeft voor elke uitkomst een gevulde pool", () => {
    for (const status of ["afgewezen", "verlopen", "tegoed-op"] as const) {
      expect(varPool(status, false).length).toBeGreaterThan(0);
    }
    expect(varPool("toegekend", true)).toBe(TOEGEKEND_OMDRAAI);
    expect(varPool("toegekend", false)).toBe(TOEGEKEND_ZONDER_GEVOLG);
  });
});

describe("varMood", () => {
  it("kijkt trots bij een toekenning en gemeen bij een afwijzing", () => {
    expect(varMood("toegekend", GEMEEN)).toBe("trots");
    expect(varMood("afgewezen", GEMEEN)).toBe("gemeen");
    expect(varMood("verlopen", GEMEEN)).toBe("portret");
  });

  it("blijft neutraal bij een roast-schild", () => {
    expect(varMood("afgewezen", SCHILD)).toBe("portret");
  });
});
