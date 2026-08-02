import { describe, it, expect } from "vitest";
import { SECTIE_IDS } from "../secties";
import { UITLEG_REGELS } from "@/features/coach/coachUitleg";
import { GEVULDE_SECTIES, SECTIE_INHOUD } from ".";

// Het register en de sectie-data kunnen los van elkaar bewerkt worden; deze
// suite is de koppeling. Een sectie zonder Rudy-regels zou stilletjes een lege
// bubbel opleveren, en een register-id die niet in SECTIES staat verdwijnt
// zonder waarschuwing van de pagina.
describe("sectie-register (#989)", () => {
  it("registreert alleen id's die in SECTIES bestaan", () => {
    for (const id of GEVULDE_SECTIES) expect(SECTIE_IDS).toContain(id);
  });

  it("koppelt elke gevulde sectie aan een component", () => {
    for (const id of GEVULDE_SECTIES) {
      expect(typeof SECTIE_INHOUD[id], id).toBe("function");
    }
  });

  it("heeft voor elke gevulde sectie ook Rudy-regels", () => {
    for (const id of GEVULDE_SECTIES) {
      expect(UITLEG_REGELS[id], id).toBeDefined();
    }
  });

  it("dekt inmiddels de eerste acht secties uit #989", () => {
    // PR 2 vult 1 t/m 8; Coach Rudy (11) kwam al mee in PR 1.
    for (const id of [
      "aan-de-slag",
      "speeldag",
      "banen",
      "uitslagen",
      "rating",
      "tiers",
      "troon",
      "kaarten",
      "rudy",
    ]) {
      expect(GEVULDE_SECTIES, id).toContain(id);
    }
  });
});
