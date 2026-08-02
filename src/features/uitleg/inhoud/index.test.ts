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

  // De belofte uit #989: álle vijftien secties zijn gevuld. Zakt dit ooit, dan
  // is er een sectie uit het register gevallen — of eentje bijgezet in SECTIES
  // zonder inhoud, en dan verdwijnt hij stil uit de inhoudsopgave.
  it("dekt alle vijftien secties uit #989", () => {
    for (const id of SECTIE_IDS) expect(GEVULDE_SECTIES, id).toContain(id);
    expect(GEVULDE_SECTIES).toHaveLength(SECTIE_IDS.length);
  });
});
