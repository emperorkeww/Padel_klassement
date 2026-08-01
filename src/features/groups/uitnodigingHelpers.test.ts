import { describe, it, expect } from "vitest";
import {
  UITNODIGING_TEKST,
  uitnodigingProbleem,
  vervalTekst,
} from "./uitnodigingHelpers";

describe("uitnodigingProbleem", () => {
  it("leest de stabiele code uit details", () => {
    expect(
      uitnodigingProbleem({
        message: "Deze uitnodiging is verlopen",
        details: "uitnodiging_verlopen",
      }),
    ).toBe("verlopen");
    expect(uitnodigingProbleem({ details: "uitnodiging_onbekend" })).toBe(
      "onbekend",
    );
    expect(uitnodigingProbleem({ details: "niet_ingelogd" })).toBe(
      "niet_ingelogd",
    );
  });

  // Een token dat geen uuid is haalt de functie niet eens; voor de speler is
  // dat hetzelfde geval als een ingetrokken link.
  it("behandelt een token dat geen uuid is als een onbekende uitnodiging", () => {
    expect(
      uitnodigingProbleem({
        code: "22P02",
        message: 'invalid input syntax for type uuid: "kapot"',
      }),
    ).toBe("onbekend");
  });

  // Vangnet voor een omgeving waar de migratie van #923 nog niet draaide.
  it("valt terug op de oude foutteksten zonder details", () => {
    expect(uitnodigingProbleem({ message: "Deze uitnodiging is verlopen" })).toBe(
      "verlopen",
    );
    expect(
      uitnodigingProbleem({ message: "Deze uitnodiging bestaat niet (meer)" }),
    ).toBe("onbekend");
  });

  it("houdt alles wat het niet herkent bij het vangnet", () => {
    expect(uitnodigingProbleem(new Error("Failed to fetch"))).toBe(
      "onbekend_probleem",
    );
    expect(uitnodigingProbleem(null)).toBe("onbekend_probleem");
  });

  it("heeft voor elk probleem een titel, uitleg en vervolgstap", () => {
    for (const tekst of Object.values(UITNODIGING_TEKST)) {
      expect(tekst.titel).toBeTruthy();
      expect(tekst.tekst).toBeTruthy();
      expect(["hub", "login", "opnieuw"]).toContain(tekst.actie);
    }
  });
});

describe("vervalTekst", () => {
  const nu = new Date("2026-08-01T12:00:00Z");
  const over = (uren: number) =>
    new Date(nu.getTime() + uren * 3600_000).toISOString();

  it("zwijgt zonder einddatum of als het nog ver weg is", () => {
    expect(vervalTekst(null, nu)).toBeNull();
    expect(vervalTekst(over(24 * 12), nu)).toBeNull();
  });

  // Verlopen krijgt een eigen scherm; dan hoort hier geen regel meer.
  it("zwijgt over een link die al verlopen is", () => {
    expect(vervalTekst(over(-1), nu)).toBeNull();
  });

  it("waarschuwt naarmate het dringend wordt", () => {
    expect(vervalTekst(over(5), nu)).toBe("Deze link verloopt binnen een dag.");
    expect(vervalTekst(over(30), nu)).toBe("Deze link verloopt over 1 dag.");
    expect(vervalTekst(over(24 * 3 + 2), nu)).toBe(
      "Deze link verloopt over 3 dagen.",
    );
  });
});
