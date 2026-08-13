import { describe, expect, it } from "vitest";
import { groepeer, tijdvakVan } from "./groepering";
import type { Melding } from "./api";

const nu = new Date("2026-08-13T14:00:00");

const melding = (created_at: string, id = created_at): Melding => ({
  id,
  soort: "poll",
  title: "Titel",
  body: "Body",
  url: "/",
  tag: `t-${id}`,
  created_at,
  read_at: null,
});

describe("tijdvakVan", () => {
  it("noemt vanochtend en vanmiddag allebei vandaag", () => {
    expect(tijdvakVan("2026-08-13T07:30:00", nu)).toBe("Vandaag");
    expect(tijdvakVan("2026-08-13T13:59:00", nu)).toBe("Vandaag");
  });

  it("rekent in kalenderdagen en niet in etmalen", () => {
    // Vijf over middernacht hoort gisteravond bij "Deze week", ook al is het
    // nog geen 24 uur geleden. Zelfde grens als formatRelativeDay.
    expect(tijdvakVan("2026-08-12T23:55:00", new Date("2026-08-13T00:05:00"))).toBe(
      "Deze week",
    );
  });

  it("houdt de zesde dag bij deze week en de zevende bij eerder", () => {
    expect(tijdvakVan("2026-08-07T14:00:00", nu)).toBe("Deze week");
    expect(tijdvakVan("2026-08-06T14:00:00", nu)).toBe("Eerder");
  });

  it("zet een melding uit de toekomst bij vandaag", () => {
    // Klokdrift met de server mag geen vierde kop opleveren.
    expect(tijdvakVan("2026-08-13T14:01:00", nu)).toBe("Vandaag");
  });
});

describe("groepeer", () => {
  it("knipt de lijst in tijdvakken zonder de volgorde te wijzigen", () => {
    const groepen = groepeer(
      [
        melding("2026-08-13T13:47:00", "a"),
        melding("2026-08-13T09:00:00", "b"),
        melding("2026-08-11T20:00:00", "c"),
        melding("2026-07-04T20:00:00", "d"),
      ],
      nu,
    );
    expect(groepen.map((g) => g.kop)).toEqual(["Vandaag", "Deze week", "Eerder"]);
    expect(groepen[0].meldingen.map((m) => m.id)).toEqual(["a", "b"]);
    expect(groepen[2].meldingen.map((m) => m.id)).toEqual(["d"]);
  });

  it("geeft één groep als alles in hetzelfde vak valt", () => {
    const groepen = groepeer([melding("2026-08-13T13:00:00")], nu);
    expect(groepen).toHaveLength(1);
  });

  it("geeft niets terug voor een lege lijst", () => {
    expect(groepeer([], nu)).toEqual([]);
  });
});
