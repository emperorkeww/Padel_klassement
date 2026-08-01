import { describe, it, expect } from "vitest";
import { AVATAR_ZIJDE, KADER_ZIJDE, naarCanvas } from "./avatarCrop";

// #921: het slepen gebeurt in schermpixels van het preview-kader, het
// uitsnijden in canvaspixels. Zonder die omrekening landt de uitsnede ergens
// anders dan waar je hem zag.
describe("naarCanvas", () => {
  it("schaalt de sleepafstand mee met de kader-canvasverhouding", () => {
    const factor = AVATAR_ZIJDE / KADER_ZIJDE;
    expect(naarCanvas(1, { x: 10, y: -20 })).toEqual({
      zoom: 1,
      x: 10 * factor,
      y: -20 * factor,
    });
  });

  it("laat de zoom ongemoeid — die is al schaalloos", () => {
    expect(naarCanvas(2.5, { x: 0, y: 0 }).zoom).toBe(2.5);
  });

  it("houdt het middelpunt op nul", () => {
    expect(naarCanvas(1, { x: 0, y: 0 })).toEqual({ zoom: 1, x: 0, y: 0 });
  });
});
