import { describe, expect, it } from "vitest";
import {
  genereerWachtwoord,
  WOORDENLIJST_LENGTE,
} from "./adminWachtwoord.ts";

describe("genereerWachtwoord", () => {
  it("levert drie woorden met streepjes en een cijfer erachter", () => {
    const wachtwoord = genereerWachtwoord();
    expect(wachtwoord).toMatch(/^[a-z]+-[a-z]+-[a-z]+\d$/);
  });

  it("herhaalt geen woord — dat leest als een fout en kost entropie", () => {
    for (let i = 0; i < 50; i++) {
      const woorden = genereerWachtwoord().replace(/\d$/, "").split("-");
      expect(new Set(woorden).size).toBe(3);
    }
  });

  it("haalt de minimumlengte van Supabase ruim (minimum_password_length = 6)", () => {
    for (let i = 0; i < 20; i++) {
      expect(genereerWachtwoord().length).toBeGreaterThanOrEqual(10);
    }
  });

  it("bevat niets dat je aan de telefoon moet spellen", () => {
    // Geen hoofdletters, geen leestekens behalve het streepje: de hele reden
    // dat dit woorden zijn en geen willekeurige tekens.
    for (let i = 0; i < 20; i++) {
      expect(genereerWachtwoord()).not.toMatch(/[A-Z]/);
      expect(genereerWachtwoord()).not.toMatch(/[^a-z0-9-]/);
    }
  });

  it("is deterministisch bij een vaste randombron", () => {
    const vast = () => 0;
    // Met een bron die altijd 0 geeft moet de "geen herhaling"-lus doorschuiven
    // in plaats van eeuwig hetzelfde woord te pakken.
    const eerste = genereerWachtwoord(vast);
    expect(eerste).toBe(genereerWachtwoord(vast));
    expect(eerste.replace(/\d$/, "").split("-")).toHaveLength(3);
  });

  it("levert bij herhaald aanroepen verschillende wachtwoorden", () => {
    const set = new Set(Array.from({ length: 30 }, () => genereerWachtwoord()));
    expect(set.size).toBeGreaterThan(25);
  });

  it("heeft een woordenlijst die groot genoeg is voor de sterkte-uitspraak", () => {
    // De kop van adminWachtwoord.ts rekent met 60 woorden ≈ 21 bits. Zakt de
    // lijst stilletjes, dan klopt die redenering niet meer.
    expect(WOORDENLIJST_LENGTE).toBeGreaterThanOrEqual(60);
  });
});
