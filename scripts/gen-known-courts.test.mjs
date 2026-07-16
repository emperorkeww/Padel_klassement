import { describe, expect, it, vi } from "vitest";
import { parseResources, renderKnownCourts } from "./gen-known-courts.mjs";

// Ingekorte nabootsing van de clubpagina: de resources-array zit als
// single-escaped JSON in een self.__next_f.push-chunk, precies zoals live
// (vastgesteld juli 2026). Namen met haken en een niet-padel-resource zitten
// erin om het parsen scherp te houden.
const RESOURCES = [
  {
    resourceId: "81ba479c-66f6-4568-a450-db6df2f5c589",
    name: "Terrein 1 (overdekt)",
    sport: "PADEL",
    features: ["roofed", "double", "crystal"],
  },
  {
    resourceId: "cc9dbe76-6192-4035-a24c-f3db0d556b97",
    name: "Terrein 3",
    sport: "PADEL",
    features: ["outdoor", "double", "crystal"],
  },
  {
    resourceId: "99999999-9999-9999-9999-999999999999",
    name: "Tennisbaan [gravel] (buiten)",
    sport: "TENNIS",
    features: ["outdoor"],
  },
];

function pageWith(payload) {
  const chunk = JSON.stringify(
    `5:["$","div",null,{"club":{"description":"Padel in Beveren"},${payload}}]`,
  );
  return [
    "<html><head></head><body>",
    '<script>self.__next_f.push([1,"onirrelevante eerste chunk"])</script>',
    `<script>self.__next_f.push([1,${chunk}])</script>`,
    "</body></html>",
  ].join("\n");
}

const HTML = pageWith(`"resources":${JSON.stringify(RESOURCES)}`);

describe("parseResources", () => {
  it("leest id, naam en type uit de escaped RSC-chunk", () => {
    expect(parseResources(HTML)).toEqual([
      {
        id: "81ba479c-66f6-4568-a450-db6df2f5c589",
        name: "Terrein 1", // "(overdekt)"-suffix gestript: het type dekt dat al
        type: "roofed",
      },
      {
        id: "cc9dbe76-6192-4035-a24c-f3db0d556b97",
        name: "Terrein 3",
        type: "outdoor",
      },
    ]);
  });

  it("filtert niet-padel-resources weg", () => {
    const ids = parseResources(HTML).map((c) => c.id);
    expect(ids).not.toContain("99999999-9999-9999-9999-999999999999");
  });

  it("onbekende features → type \"\" met waarschuwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const html = pageWith(
      `"resources":${JSON.stringify([
        {
          resourceId: "81ba479c-66f6-4568-a450-db6df2f5c589",
          name: "Terrein X",
          sport: "PADEL",
          features: ["double"],
        },
      ])}`,
    );
    expect(parseResources(html)[0].type).toBe("");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("faalt luid als de resources-marker ontbreekt", () => {
    const html = pageWith('"openingHours":[]');
    expect(() => parseResources(html)).toThrow(/niet gevonden/);
  });

  it("faalt luid bij 0 padelbanen", () => {
    const html = pageWith('"resources":[]');
    expect(() => parseResources(html)).toThrow(/0 padelbanen/);
  });
});

describe("renderKnownCourts", () => {
  const clubs = [
    {
      name: "LAGO CLUB Padel Beveren",
      tenantId: "91d8d419-3736-498e-90be-362de786d588",
      courts: parseResources(HTML),
    },
  ];

  it("rendert deterministisch een geldig knownCourts.ts", () => {
    const out = renderKnownCourts(clubs);
    expect(out).toBe(renderKnownCourts(clubs)); // geen timestamps e.d.
    expect(out).toContain('"91d8d419-3736-498e-90be-362de786d588": [');
    expect(out).toContain(
      '{ id: "81ba479c-66f6-4568-a450-db6df2f5c589", name: "Terrein 1", type: "roofed" },',
    );
    expect(out).toContain("1 overdekte baan + 1 buitenbaan");
    expect(out).toContain("export type KnownCourt");
  });
});
