import { describe, expect, it } from "vitest";
import {
  belgischeClubs,
  parseClubs,
  relevanteClubs,
  zoekterm,
  zoekUrl,
} from "./clubZoeken.ts";

// Verkorte weergave van een echte RSC-payload van playtomic.com/search:
// flight-regels met nummerprefix, de zoekcomponent en daarin __blokData.clubs.
// De ruis eromheen staat er bewust in — die moet de parser overleven.
const PAYLOAD = [
  '3:I[47690,[],""]',
  '0:["$","div",null,{"children":[{"_uid":"964d3c33","page":1,"size":"30",',
  '"query":"lago beveren","component":"club_search_results",',
  '"show_pagination_buttons":true,"__blokData":{"clubs":[',
  '{"id":"91d8d419-3736-498e-90be-362de786d588","name":"LAGO CLUB Padel Beveren",',
  '"slug":"lago-club-padel-beveren","country_code":"BE",',
  '"address":{"street":"Pastoor Steenssensstraat 108a","postal_code":"9120"},',
  '"images":["https://res.cloudinary.com/playtomic/image/upload/v1/a.jpg"]},',
  '{"id":"cb21ad12-895b-4066-879f-36a9537339f3","name":"Hangar Padel Club",',
  '"slug":"hangar-padel-club","country_code":"BE",',
  '"address":{"street":"Vesten 43","postal_code":"9120"},"images":[]},',
  '{"id":"0f67f644-f859-48bc-a86a-3d56481dd484","name":"Centro Sportivo Bettinelli",',
  '"slug":"centro-sportivo-bettinelli","country_code":"IT",',
  '"address":{"street":"Via Roma 1","postal_code":"20090"},"images":[]}',
  ']}}]}]',
].join("");

describe("parseClubs", () => {
  it("leest de clubs uit een zoek-payload", () => {
    const clubs = parseClubs(PAYLOAD);
    expect(clubs.map((c) => c.name)).toEqual([
      "LAGO CLUB Padel Beveren",
      "Hangar Padel Club",
      "Centro Sportivo Bettinelli",
    ]);
    expect(clubs[0]).toEqual({
      id: "91d8d419-3736-498e-90be-362de786d588",
      name: "LAGO CLUB Padel Beveren",
      slug: "lago-club-padel-beveren",
      countryCode: "BE",
      street: "Pastoor Steenssensstraat 108a",
      postalCode: "9120",
    });
  });

  // Dezelfde JSON komt ge-escaped voor in de HTML-variant van de pagina
  // (self.__next_f.push). Handig als vangnet als de RSC-header ooit wegvalt.
  it("leest ook de ge-escapete variant uit de HTML", () => {
    const html = `<script>self.__next_f.push([1,${JSON.stringify(PAYLOAD)}])</script>`;
    expect(parseClubs(html).map((c) => c.slug)).toContain(
      "lago-club-padel-beveren",
    );
  });

  // Clubnamen met haakjes of aanhalingstekens mogen het haakjes-tellen niet
  // laten ontsporen — vandaar de string-bewuste scanner.
  it("struikelt niet over haakjes en aanhalingstekens in een naam", () => {
    const raar =
      '{"clubs":[{"id":"a1","name":"Padel [Oost] \\"De Kaai\\"","slug":"kaai","country_code":"BE","address":{}}]}';
    expect(parseClubs(raar)).toEqual([
      {
        id: "a1",
        name: 'Padel [Oost] "De Kaai"',
        slug: "kaai",
        countryCode: "BE",
        street: "",
        postalCode: "",
      },
    ]);
  });

  it("negeert dezelfde club in twee blokken", () => {
    expect(parseClubs(PAYLOAD + PAYLOAD)).toHaveLength(3);
  });

  // Faalt leeg, niet luid: een payload die we niet herkennen betekent "geen
  // treffers", zodat de rest van de clubkiezer blijft werken.
  it("geeft leeg terug bij een onbekende of kapotte payload", () => {
    expect(parseClubs("")).toEqual([]);
    expect(parseClubs("<html>zoekpagina zonder data</html>")).toEqual([]);
    expect(parseClubs('{"clubs":[{"id":')).toEqual([]);
    expect(parseClubs('{"clubs": "geen array"}')).toEqual([]);
  });

  it("slaat rijen zonder id of naam over", () => {
    const half = '{"clubs":[{"id":"a1","slug":"x","country_code":"BE"},{"name":"Naamloos"}]}';
    expect(parseClubs(half)).toEqual([]);
  });
});

describe("zoekterm", () => {
  // Het oude country_code=BE bestaat niet meer; het land als woord meesturen is
  // wat er nog van over is (zie de uitleg in clubZoeken.ts).
  it("plakt het land aan de zoekterm", () => {
    expect(zoekterm("hangar")).toBe("hangar belgium");
    expect(zoekterm("  lago   beveren ")).toBe("lago beveren belgium");
  });

  it("doet dat niet dubbel als de gebruiker het land al noemt", () => {
    expect(zoekterm("hangar belgië")).toBe("hangar belgië");
    expect(zoekterm("padel Belgium")).toBe("padel Belgium");
  });

  it("codeert de zoekterm in de URL", () => {
    expect(zoekUrl("lago beveren")).toBe(
      "https://playtomic.com/search?q=lago%20beveren%20belgium",
    );
  });
});

describe("belgischeClubs", () => {
  it("houdt alleen Belgische clubs over, in volgorde van relevantie", () => {
    expect(belgischeClubs(parseClubs(PAYLOAD)).map((c) => c.slug)).toEqual([
      "lago-club-padel-beveren",
      "hangar-padel-club",
    ]);
  });

  it("kapt af op de limiet", () => {
    const veel = Array.from({ length: 12 }, (_, i) => ({
      id: `id-${i}`,
      name: `Club ${i}`,
      slug: `club-${i}`,
      countryCode: "BE",
      street: "",
      postalCode: "",
    }));
    expect(belgischeClubs(veel)).toHaveLength(10);
    expect(belgischeClubs(veel, 3).map((c) => c.slug)).toEqual([
      "club-0",
      "club-1",
      "club-2",
    ]);
  });
});

describe("relevanteClubs", () => {
  const clubs = parseClubs(PAYLOAD);

  // De landhint sleept clubs mee die alleen op "belgium" matchten; die horen
  // niet in een lijst van tien.
  it("houdt alleen de clubs over die op elk woord matchen", () => {
    expect(relevanteClubs(clubs, "lago beveren").map((c) => c.slug)).toEqual([
      "lago-club-padel-beveren",
    ]);
  });

  it("matcht ook op het adres", () => {
    expect(relevanteClubs(clubs, "vesten").map((c) => c.slug)).toEqual([
      "hangar-padel-club",
    ]);
    expect(relevanteClubs(clubs, "9120").map((c) => c.slug)).toEqual([
      "lago-club-padel-beveren",
      "hangar-padel-club",
    ]);
  });

  it("negeert het land en te korte woorden", () => {
    expect(relevanteClubs(clubs, "lago belgium").map((c) => c.slug)).toEqual([
      "lago-club-padel-beveren",
    ]);
  });

  // Liever de lijst van Playtomic dan een leeg scherm: hij vond ze om een
  // reden die wij niet zien (oude naam, deelgemeente).
  it("valt terug op alles als het filter niets overhoudt", () => {
    expect(relevanteClubs(clubs, "zzzz")).toEqual(clubs);
    expect(relevanteClubs(clubs, "be")).toEqual(clubs);
  });
});
