import { describe, expect, it } from "vitest";
import { roastSeed } from "@/features/coach/roastTone";
import { serveerTeam } from "./serve";

describe("serveerTeam", () => {
  it("is deterministisch: zelfde match.id geeft altijd dezelfde kant", () => {
    const eerste = serveerTeam({ id: "5b3f0c1a-9d2e-4f6b-8a7c-1e2d3c4b5a69" });
    for (let i = 0; i < 10; i++) {
      expect(serveerTeam({ id: "5b3f0c1a-9d2e-4f6b-8a7c-1e2d3c4b5a69" })).toBe(
        eerste,
      );
    }
  });

  it("hangt af van match.id: verschillende ids kunnen anders uitpakken", () => {
    const kanten = new Set(
      ["m-1", "m-2", "m-3", "m-4"].map((id) => serveerTeam({ id })),
    );
    expect(kanten).toEqual(new Set(["a", "b"]));
  });

  it("verdeelt redelijk over veel ids", () => {
    const telling = { a: 0, b: 0 };
    for (let i = 0; i < 200; i++) {
      telling[serveerTeam({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` })]++;
    }
    // Geen exacte 50/50-eis, wel dat beide kanten ruim voorkomen.
    expect(telling.a).toBeGreaterThan(60);
    expect(telling.b).toBeGreaterThan(60);
  });

  it("blijft correct bij een negatieve hash (roastSeed is signed 32-bit)", () => {
    // Zoek een id waarvan de seed negatief is, zodat dit pad echt gedekt is.
    let i = 0;
    while (roastSeed(`neg-${i}`) >= 0) i++;
    const id = `neg-${i}`;
    const seed = roastSeed(id);
    expect(seed).toBeLessThan(0);
    // Negatief-even → "a", negatief-oneven → "b": pariteit blijft leidend.
    expect(serveerTeam({ id })).toBe(Math.abs(seed) % 2 === 0 ? "a" : "b");
  });
});
