import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Dekking van de sheet-stijlen (#1183).
 *
 * De bug die dit vangt: NewMatchSheet importeerde zelf geen CSS. Zijn klassen
 * stonden in Matches.css, en die wordt alleen door MatchesSectie geimporteerd —
 * dus met cssCodeSplit belandde die CSS in de route-chunk van /spelen en
 * nergens anders. Op de speeldagpagina en de Vandaag-tab (beide via
 * LossePartij) viel het hele sheet terug op de UA-stijlen van <button>.
 *
 * Dat bleef onopgemerkt omdat jsdom geen CSS uitrekent: NewMatchSheet.test.tsx
 * bleef groen terwijl de pagina in productie ongestyled was. Deze suite kijkt
 * daarom naar de bron — welk bestand hoort erbij, en wordt het geimporteerd —
 * in dezelfde geest als src/components/ui/glasIntegratie.test.ts.
 */

const lees = (pad: string) => readFileSync(pad, "utf8");

const COMPONENT = "src/features/matches/components/NewMatchSheet.tsx";
const tsx = lees(COMPONENT);

/** Stylesheets die overal al liggen: DashboardLayout.tsx importeert ui.css en
 *  glas.css, main.tsx index.css. Klassen daaruit kunnen dus niet ontbreken. */
const GLOBAAL = [
  "src/app/index.css",
  "src/components/ui/ui.css",
  "src/components/ui/glas.css",
];

/** De relatieve CSS-imports van de component zelf ("./NewMatchSheet.css"). */
function eigenStylesheets(bron: string, map: string): string[] {
  return [...bron.matchAll(/^import\s+"\.\/([^"]+\.css)";$/gm)].map(
    (m) => `${map}/${m[1]}`,
  );
}

/** De klassen die de component rendert.
 *
 *  Alleen tokens met een koppelteken of underscore tellen mee. Losse woorden
 *  ("tabs", "input", "btn") zijn zonder uitzondering generieke ui.css-klassen,
 *  en ze zijn niet te onderscheiden van de JS-identifiers die in een
 *  `className={...}`-expressie meelopen (`team`, `guest`, `full`). De klassen
 *  waar het hier om gaat — pick-chip, pick-grid, guest-add, teamzone__* —
 *  dragen allemaal wel zo'n scheiding. */
function gerenderdeKlassen(bron: string): string[] {
  const regios = [
    ...bron.matchAll(
      /className=(?:"([^"]*)"|\{([\s\S]*?)\}\s*\n?\s*(?=[a-zA-Z]|\/|>))/g,
    ),
  ].map((m) => m[1] ?? m[2] ?? "");
  const uniek = new Set<string>();
  for (const regio of regios) {
    for (const token of regio.split(/[^a-z0-9_-]+/)) {
      // `pick-chip--${team}` levert na het splitsen de stam `pick-chip--` op;
      // die eindigt op een scheiding en valt hier weg. De echte varianten
      // (pick-chip--a/--b) staan gewoon in de CSS.
      if (/^[a-z][a-z0-9]*((--?|__)[a-z0-9]+)+$/.test(token)) uniek.add(token);
    }
  }
  return [...uniek].sort();
}

describe("stijlen van het match-sheet (#1183)", () => {
  const map = COMPONENT.slice(0, COMPONENT.lastIndexOf("/"));
  const eigen = eigenStylesheets(tsx, map);

  it("brengt zijn eigen stylesheet mee", () => {
    // Zonder deze import laadt de CSS alleen op de route die hem toevallig
    // elders importeert — precies de bug uit #1183.
    expect(eigen).toContain(`${map}/NewMatchSheet.css`);
  });

  it("dekt elke klasse die het rendert", () => {
    const css = [...eigen, ...GLOBAAL].map(lees).join("\n");
    const ontbreekt = gerenderdeKlassen(tsx).filter(
      (klasse) => !new RegExp(`\\.${klasse}[^a-z0-9_-]`).test(css),
    );
    expect(ontbreekt).toEqual([]);
  });

  it("laat geen sheet-klassen achter in Matches.css", () => {
    // Matches.css hoort bij MatchesSectie (filters, historie, de zwevende
    // knop). Komt er weer een sheet-klasse in te staan, dan is hij op de
    // speeldagpagina onzichtbaar.
    const matches = lees("src/features/matches/Matches.css");
    for (const klasse of ["pick-chip", "pick-grid", "guest-add", "pick-teams"]) {
      expect(matches).not.toMatch(new RegExp(`\\.${klasse}[^a-z0-9_-]`));
    }
  });
});
