// Bewaking van de uitgesneden Zwarte Piet-onderdelen (#834).
//
// De assets zijn binaire WebP's: in een pull request is er niet aan te zien of
// de master leeg is gekeyd, of de voorlaag het halve frame heeft meegenomen, of
// de registratie een halve procent is verschoven. Precies die drie fouten
// kosten de kaart het meest — en alle drie zijn ze pas op de kaart zichtbaar.
//
// `scripts/piet-onderdelen.py` meet ze daarom bij het snijden en legt de
// uitkomst in piet-onderdelen.json vast. Deze test leest dat manifest naast de
// CSS en het masterregister, zodat een kapotte uitsnede in de testuitvoer
// opvalt in plaats van pas op /dev/piet.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import MANIFEST from "./assets/piet-onderdelen.json";
import { KAART_MASTERS } from "@/features/rating/components/kaartMasters";

const MAP = "src/features/rating/components/piet";
const lees = (naam: string) => readFileSync(resolve(process.cwd(), `${MAP}/${naam}`));
const CSS = readFileSync(resolve(process.cwd(), `${MAP}/PietEffect.css`), "utf8");

/** `--piet-master-left: -18.6%;` → -0.186 */
const cssFractie = (naam: string) => {
  const m = new RegExp(`--piet-master-${naam}:\\s*(-?[\\d.]+)%`).exec(CSS);
  expect(m, `--piet-master-${naam} ontbreekt in PietEffect.css`).not.toBeNull();
  return Number(m![1]) / 100;
};

describe("Piet-onderdelen", () => {
  it("levert master en voorlaag als afzonderlijke transparante WebP's", () => {
    // Fysiek gescheiden bronnen zijn de hele reden dat er geen frontmask meer
    // is. Wordt er ooit één bestand van gemaakt, dan kan een runtime-masker
    // alsnog lijstpixels over de staf of het cadeau leggen.
    for (const naam of ["piet-master.webp", "piet-front.webp"]) {
      const bytes = lees(`assets/${naam}`);
      expect(bytes.toString("ascii", 0, 4), naam).toBe("RIFF");
      expect(bytes.toString("ascii", 12, 16), naam).toBe("VP8X");
      // Bit 4 van de VP8X-featureflags: het bestand heeft een alfakanaal.
      expect(bytes[20] & 0x10, `${naam} mist alfa`).toBe(0x10);
    }
    expect(lees("assets/piet-master.webp")).not.toEqual(
      lees("assets/piet-front.webp"),
    );
  });

  it("keyt geen van beide lagen leeg", () => {
    // Een weggekeyde laag levert geen foutmelding op — hij wordt alleen
    // onzichtbaar, en dat valt pas op als iemand goed kijkt.
    expect(MANIFEST.master.alfa, "master is vrijwel leeg gekeyd").toBeGreaterThan(
      0.03,
    );
    expect(MANIFEST.front.alfa, "voorlaag is vrijwel leeg gekeyd").toBeGreaterThan(
      0.05,
    );
    // En geen dichte rechthoek: dan is de zwartkey overgeslagen.
    expect(MANIFEST.front.dekking).toBeLessThan(0.6);
  });

  it("houdt het kaartvlak leeg in de master", () => {
    // Het hele vlak binnen de gouden lijst gaat uit het artwork, want daar
    // staat de ingebakken rating, naam, portret, statblok en badge-rij van de
    // referentie in. Blijft daar iets van staan, dan komt het als spookkopie
    // naast de échte tekst van de kaart te staan.
    expect(MANIFEST.master.restVlak, "er staat nog artwork op het kaartvlak")
      .toBeLessThan(0.002);
  });

  it("laat de voorlaag niet dieper de kaart in reiken dan zijn band", () => {
    // De voorlaag wordt vóór de kaartinhoud getekend. Reikt hij verder dan de
    // rand waarvoor hij bedoeld is, dan loopt er een ketting over de rating.
    // Crest en medaille zijn in de meting uitgezonderd: die twee liggen per
    // ontwerp op de boven- en onderrand van de kaart.
    expect(MANIFEST.front.restVlak, "de voorlaag lekt het kaartvlak in")
      .toBeLessThan(0.005);
  });

  it("deelt één registratie tussen manifest, CSS en masterregister", () => {
    // Drie lezers, één uitsnede. Loopt er één weg, dan staat het artwork náást
    // de kaart — in de DOM, op de poster, of allebei een beetje.
    const { links, boven, breedte } = MANIFEST.registratie;
    expect(cssFractie("left")).toBeCloseTo(links, 4);
    expect(cssFractie("top")).toBeCloseTo(boven, 4);
    expect(cssFractie("width")).toBeCloseTo(breedte, 4);

    const master = KAART_MASTERS.piet;
    expect(master.links).toBeCloseTo(links, 4);
    expect(master.boven).toBeCloseTo(boven, 4);
    expect(master.breedte).toBeCloseTo(breedte, 4);
    expect(master.voorBron, "de voorlaag hoort een eigen bron te zijn").toBeTruthy();
    expect(master.voorBron).not.toBe(master.bron);
    expect(
      "voorMasker" in master,
      "een frontmask hoort er niet meer te zijn: de voorbron ís het masker",
    ).toBe(false);
  });

  it("houdt de ruit-tegel naadloos herhaalbaar", () => {
    // De tegel is exact één periode van de watteernaad (103 × 94
    // referentiepixels). Wijkt die maat af, dan verspringt het patroon bij elke
    // herhaling en leest het kaartvlak als behang met naden.
    const [breedte, hoogte] = MANIFEST.vlak.pixels;
    expect(MANIFEST.vlak.tegel).toBe(true);
    expect(breedte).toBe(103);
    expect(hoogte).toBe(94);
    // De CSS-maat is diezelfde periode als fractie van de kaartbreedte (785
    // referentiepixels breed).
    expect(CSS).toContain(`calc(var(--fut-kw) * ${(breedte / 785).toFixed(4)})`);
    expect(CSS).toContain(`calc(var(--fut-kw) * ${(hoogte / 785).toFixed(4)})`);
  });
});
