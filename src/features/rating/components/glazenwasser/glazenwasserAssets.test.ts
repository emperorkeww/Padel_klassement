// Bewaking van de uitgesneden Glazenwasser-onderdelen (#834).
//
// De assets zijn binaire WebP's: in een pull request is er niet aan te zien of
// een onderdeel leeg is gekeyd of zijn buurman heeft meegenomen. Precies die
// twee fouten kosten de kaart het meest — een leeg onderdeel maakt het vlak
// vlak, een meegenomen buurman zet een spookkopie op de kaart, een halve
// verschuiving verderop.
//
// `scripts/glazenwasser-onderdelen.py` meet ze daarom bij het snijden en legt de
// uitkomst in gw-onderdelen.json vast. Deze test leest dat manifest, zodat een
// kapotte uitsnede in de testuitvoer opvalt in plaats van pas op de kaart.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import DOZEN from "./assets/gw-onderdelen.json";
import { GW_LAGEN } from "./glazenwasserLayout";

type Onderdeel = {
  doos: number[];
  pixels: number[];
  alfa: number;
  dekking: number;
  kB: number;
  overlap: Record<string, number>;
  /** Geweven, herhalende textuur in plaats van een uitsnede uit de referentie.
   *  Zo'n onderdeel heeft geen plek op het canvas: zijn doos is betekenisloos en
   *  hij valt buiten de metingen die uitsnedes met elkaar vergelijken. */
  tegel?: boolean;
  /** Samengesteld en al verticaal herbemonsterd naar de kaartverhouding (de
   *  ring). Zo'n onderdeel is groter dan het referentiecanvas en zijn doos staat
   *  in kaartfracties, dus de uitsnedecontroles gelden er niet voor. */
  voorbewerkt?: boolean;
};

/** Is dit onderdeel een rechtstreekse uitsnede uit de referentie? Alleen dan
 *  hebben de doos-, canvas- en overlapcontroles betekenis. */
const isUitsnede = ([, d]: [string, Onderdeel]) => !d.tegel && !d.voorbewerkt;

const ONDERDELEN = Object.entries(DOZEN) as [string, Onderdeel][];

/** Canvas van de referentie waaruit gesneden wordt (docs/fut-kaarten/
 *  referentie_glazenwasser.png). Een doos die hierbuiten valt is een snijfout. */
const CANVAS = { breedte: 1105, hoogte: 1536 };

describe("Glazenwasser-onderdelen", () => {
  it("gebruikt voor de voorlaag een echt alfamasker", () => {
    const masker = readFileSync(
      resolve(
        process.cwd(),
        "src/features/rating/components/glazenwasser/assets/glazenwasser-front-mask.webp",
      ),
    );
    expect(masker.toString("ascii", 0, 4)).toBe("RIFF");
    expect(masker.toString("ascii", 12, 16)).toBe("VP8X");
    // Bit 4 van de VP8X-featureflags betekent dat het bestand een alfakanaal
    // bevat. Zonder dit bit ziet CSS het hele rechthoekige masker als opaak.
    expect(masker[20] & 0x10).toBe(0x10);
  });

  it("levert elk onderdeel dat de layout opvraagt", () => {
    const gevraagd = new Set(GW_LAGEN.map((l) => l.bron));
    const geleverd = new Set(ONDERDELEN.map(([naam]) => naam));
    for (const bron of gevraagd) {
      expect(geleverd, `${bron} ontbreekt in het manifest`).toContain(bron);
    }
  });

  it("meet elk onderdeel volledig op", () => {
    for (const [naam, deel] of ONDERDELEN) {
      expect(deel.doos, `${naam} heeft geen doos`).toHaveLength(4);
      expect(deel.pixels, `${naam} heeft geen pixelmaat`).toHaveLength(4);
      for (const getal of [...deel.doos, ...deel.pixels, deel.alfa, deel.dekking]) {
        expect(Number.isFinite(getal), `${naam} heeft een ongeldige maat`).toBe(
          true,
        );
      }
      expect(deel.overlap, `${naam} mist een overlapmeting`).toBeTypeOf("object");
    }
  });

  it("houdt elke uitsnede binnen het referentiecanvas", () => {
    for (const [naam, deel] of ONDERDELEN.filter(isUitsnede)) {
      const [x, y, breedte, hoogte] = deel.pixels;
      expect(breedte, `${naam} is leeg`).toBeGreaterThan(0);
      expect(hoogte, `${naam} is leeg`).toBeGreaterThan(0);
      expect(x, `${naam} begint links buiten het canvas`).toBeGreaterThanOrEqual(0);
      expect(y, `${naam} begint boven het canvas`).toBeGreaterThanOrEqual(0);
      expect(
        x + breedte,
        `${naam} loopt rechts buiten het canvas`,
      ).toBeLessThanOrEqual(CANVAS.breedte);
      expect(
        y + hoogte,
        `${naam} loopt onder het canvas uit`,
      ).toBeLessThanOrEqual(CANVAS.hoogte);
    }
  });

  it("laat geen onderdeel een ander onderdeel meesnijden", () => {
    // Elk onderdeel wordt los geplaatst, met een eigen schaal en verschuiving.
    // Zit een tweede voorwerp in de uitsnede, dan komt dát voorwerp dus een
    // stuk verderop nóg een keer op de kaart — de spookemmer en de spooktrekker
    // waarmee dit begon. Een randje overlap hoort erbij (schuim loopt over de
    // lijst, water over het onderschild); een halve buurman niet.
    const GRENS = 0.15;
    const overtreders: string[] = [];
    for (const [naam, deel] of ONDERDELEN) {
      for (const [ander, mate] of Object.entries(deel.overlap)) {
        // De glastextuur ligt per definitie ónder alles; die telt niet mee.
        if (naam === "glas" || ander === "glas") continue;
        if (mate > GRENS) overtreders.push(`${naam} ⊃ ${ander} (${mate})`);
      }
    }
    expect(overtreders, "onderdelen bevatten elkaar").toEqual([]);
  });

  it("keyt geen enkel onderdeel leeg", () => {
    // Een onderdeel dat is weggekeyd levert geen foutmelding op — het wordt
    // alleen onzichtbaar op de kaart, en dat valt pas op als iemand goed kijkt.
    // De glastegel stond op 0,007: een vrijwel lege laag die met contrast- en
    // verzadigingsfilters te lijf werd gegaan, terwijl geen van beide filters
    // alfa kan maken. Dáárom staat deze ondergrens er.
    for (const [naam, deel] of ONDERDELEN) {
      const ondergrens = naam === "water-back" ? 0.02 : 0.05;
      expect(deel.alfa, `${naam} is vrijwel leeg gekeyd`).toBeGreaterThan(
        ondergrens,
      );
    }
  });

  it("houdt de glastegel naadloos", () => {
    // Een tegel wordt herhaald; loopt zijn rechterrand niet door in zijn
    // linkerrand, dan staat er een raster van naden over het kaartvlak. De
    // overvloeier in `natglas()` zorgt daarvoor — deze test legt de eis vast.
    const tegels = ONDERDELEN.filter(([, d]) => d.tegel);
    expect(tegels.length, "er hoort precies één geweven tegel te zijn").toBe(1);
    for (const [naam, deel] of tegels) {
      expect(deel.doos, `${naam} hoort de hele laag te vullen`).toEqual([
        0, 0, 1, 1,
      ]);
      expect(deel.overlap, `${naam} hoort buiten de overlapmeting te vallen`)
        .toEqual({});
    }
  });

  it("houdt doos en pixelmaat op dezelfde uitsnede", () => {
    // `doos` is de pixelmaat omgerekend naar kaartfracties; lopen die twee uit
    // de pas, dan is het manifest met de hand bijgewerkt in plaats van gedraaid.
    const RX0 = 0;
    const RY0 = 0;
    const RW = CANVAS.breedte;
    const RH = CANVAS.hoogte;
    for (const [naam, deel] of ONDERDELEN.filter(isUitsnede)) {
      const [x, y, breedte, hoogte] = deel.pixels;
      const verwacht = [
        (x - RX0) / RW,
        (y - RY0) / RH,
        breedte / RW,
        hoogte / RH,
      ];
      for (const [i, waarde] of verwacht.entries()) {
        expect(deel.doos[i], `${naam} doos[${i}] hoort bij een andere uitsnede`)
          .toBeCloseTo(waarde, 3);
      }
    }
  });
});
