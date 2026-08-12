import { describe, it, expect } from "vitest";
import { belLabel, tellerTekst, MAX_TELLER } from "./bel";

describe("belLabel (#1090)", () => {
  it("belooft niets zolang het aantal onbekend is", () => {
    expect(belLabel(null)).toBe("Meldingen");
  });

  it("zet het aantal voluit in de naam", () => {
    expect(belLabel(0)).toBe("Meldingen, geen ongelezen meldingen");
    expect(belLabel(1)).toBe("Meldingen, 1 ongelezen melding");
    expect(belLabel(23)).toBe("Meldingen, 23 ongelezen meldingen");
  });

  // #1232: twee verschillende dingen — wat je nog niet zág en wat nog op een
  // antwoord wacht. Ze worden dus niet bij elkaar opgeteld.
  describe("openstaande vriendschapsverzoeken (#1232)", () => {
    it("noemt het verzoek náást de ongelezen meldingen", () => {
      expect(belLabel(2, 1)).toBe(
        "Meldingen, 2 ongelezen meldingen — 1 vriendschapsverzoek wacht op je",
      );
    });

    it("vervoegt het meervoud", () => {
      expect(belLabel(0, 3)).toBe(
        "Meldingen, geen ongelezen meldingen — 3 vriendschapsverzoeken wachten op je",
      );
    });

    it("noemt het ook als de telling nog onbekend is", () => {
      expect(belLabel(null, 1)).toBe(
        "Meldingen — 1 vriendschapsverzoek wacht op je",
      );
    });

    it("zwijgt zonder verzoeken", () => {
      expect(belLabel(1, 0)).toBe("Meldingen, 1 ongelezen melding");
    });
  });
});

describe("tellerTekst (#1090)", () => {
  it("toont het cijfer tot aan het plafond", () => {
    expect(tellerTekst(1)).toBe("1");
    expect(tellerTekst(MAX_TELLER)).toBe("9");
  });

  it("kapt daarboven af", () => {
    expect(tellerTekst(MAX_TELLER + 1)).toBe("9+");
    expect(tellerTekst(120)).toBe("9+");
  });
});
