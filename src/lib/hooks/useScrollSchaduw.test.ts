import { describe, it, expect } from "vitest";
import { schaduwVoor } from "./useScrollSchaduw";

// #912: de filterchips van de feed lopen op telefoonbreedte van het scherm af
// zonder scrollbar. Deze afleiding bepaalt aan welke kant de fade komt.
describe("schaduwVoor", () => {
  it("meldt niets als alles past", () => {
    expect(schaduwVoor(0, 300, 300)).toBe("geen");
  });

  it("wijst naar rechts aan het begin van een te brede rij", () => {
    expect(schaduwVoor(0, 900, 300)).toBe("rechts");
  });

  it("wijst naar beide kanten in het midden", () => {
    expect(schaduwVoor(300, 900, 300)).toBe("beide");
  });

  it("wijst alleen naar links aan het einde", () => {
    expect(schaduwVoor(600, 900, 300)).toBe("links");
  });

  it("negeert sub-pixel-afronding aan de randen", () => {
    // Zonder speling blijft er een fade hangen die niets meer afdekt.
    expect(schaduwVoor(0.5, 900.4, 900)).toBe("geen");
  });
});
