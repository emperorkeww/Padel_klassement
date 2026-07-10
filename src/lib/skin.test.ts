import { describe, it, expect } from "vitest";
import { skinText } from "./skin";

describe("skinText", () => {
  it("geeft in licht/donker altijd de standaardtekst terug", () => {
    expect(skinText("Klassement", "light")).toBe("Klassement");
    expect(skinText("Klassement", "dark")).toBe("Klassement");
  });

  it("vertaalt gecureerde teksten in het smurf-thema", () => {
    expect(skinText("Klassement", "smurf")).toBe("Smurfklassement");
    expect(skinText("+ Match loggen", "smurf")).toBe("+ Smurf een match");
    expect(skinText("😤 Nemesis", "smurf")).toBe("😈 Jouw Gargamel");
  });

  it("valt bij een onbekende tekst terug op de tekst zelf", () => {
    expect(skinText("Willekeurige zin", "smurf")).toBe("Willekeurige zin");
    expect(skinText("", "smurf")).toBe("");
  });
});
