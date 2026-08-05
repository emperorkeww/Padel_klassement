import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import {
  KAART_MASTERS,
  masterVoor,
  type MasterNaam,
  type MasterRegistratie,
} from "./kaartMasters";

// De drifttest van #895. De registratie van elk master staat op twee plekken:
// als custom properties in het *Effect.css (voor de DOM) en als getallen in
// KAART_MASTERS (voor de canvas-poster). Eén waarheid is niet haalbaar — CSS
// kan geen TS importeren en de posters mogen geen live tokens lezen (#125) —
// dus bewaakt deze test de tweede boekhouding, net als de synctest in
// futKaartCanvas.test.ts dat voor de kleurregisters doet.
//
// Bewust via node:fs en niet via Vite's ?raw: Vitest kortsluit CSS-imports op
// een lege string, óók met de raw-query, dus dan zou de test stil niets
// vergelijken.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");

const NAMEN = Object.keys(KAART_MASTERS) as MasterNaam[];

/** `--<prefix>-master-<veld>` uit het stylesheet, als getal. Procenten worden
 *  fracties, graden blijven graden — precies zoals de tabel ze bewaart. */
function cssGetal(css: string, prefix: string, veld: string): number {
  const m = new RegExp(`--${prefix}-master-${veld}:\\s*(-?[\\d.]+)(%|deg)?`).exec(
    css,
  );
  if (!m) throw new Error(`--${prefix}-master-${veld} ontbreekt in de CSS`);
  return m[2] === "%" ? Number(m[1]) / 100 : Number(m[1]);
}

/** Het CSS-blok van één laag, bv. `.goat-effect--binnen .goat-effect__master`.
 *  De klassenaam verschilt per editie (de storm heet `inform-storm`), dus de
 *  laagnaam is het anker, niet de prefix. */
function laagBlok(css: string, laag: string): string {
  const m = new RegExp(
    `--${laag}\\s+\\.[a-z-]+__master\\s*\\{([^}]*)\\}`,
    "i",
  ).exec(css);
  return m ? m[1] : "";
}

describe("kaartMasters ↔ *Effect.css (#895)", () => {
  it.each(NAMEN)("%s: de vijf registratiewaarden staan gelijk", (naam) => {
    const r = KAART_MASTERS[naam];
    const css = lees(`./${r.css}`);
    expect(cssGetal(css, r.prefix, "left")).toBeCloseTo(r.links, 6);
    expect(cssGetal(css, r.prefix, "top")).toBeCloseTo(r.boven, 6);
    expect(cssGetal(css, r.prefix, "width")).toBeCloseTo(r.breedte, 6);
    expect(cssGetal(css, r.prefix, "scale")).toBeCloseTo(r.schaal, 6);
    expect(cssGetal(css, r.prefix, "rotate")).toBeCloseTo(r.rotatie, 6);
  });

  it.each(NAMEN)("%s: de binnenlaag deelt zijn dekking en masker", (naam) => {
    const r = KAART_MASTERS[naam];
    const blok = laagBlok(lees(`./${r.css}`), "binnen");
    const opacity = /opacity:\s*([\d.]+)/.exec(blok);
    // Geen opacity in de CSS betekent volle dekking; de tabel schrijft die 1
    // dan expliciet op.
    expect(opacity ? Number(opacity[1]) : 1).toBeCloseTo(r.binnenAlpha, 6);
    verwachtMasker(maskerUit(blok), r.binnenMasker);
  });

  it.each(NAMEN)("%s: de voorlaag deelt zijn frontmasker", (naam) => {
    const r = KAART_MASTERS[naam];
    const blok = laagBlok(lees(`./${r.css}`), "voor");
    verwachtMasker(maskerUit(blok), r.voorMasker);
  });

  it.each(NAMEN)("%s: de contactschaduw van de voorlaag klopt", (naam) => {
    const r = KAART_MASTERS[naam];
    const blok = laagBlok(lees(`./${r.css}`), "voor");
    const schaduw = /drop-shadow\(([\s\S]*?)\)\s*;/.exec(blok);
    expect(schaduw, `${naam} mist zijn drop-shadow`).not.toBeNull();
    // De CSS schrijft de offsets als calc(var(--fut-kw) * f); de kleur volgt
    // als laatste. Alleen de drie fracties en de rgba-kanalen tellen.
    const tekst = schaduw![1];
    const fracties = [...tekst.matchAll(/\*\s*(-?[\d.]+)\)/g)].map((m) =>
      Number(m[1]),
    );
    // Een offset van exact 0 staat in de CSS als kale `0`, zonder calc.
    const [dx, dy, blur] = r.voorSchaduw;
    expect(fracties).toEqual([dx, dy, blur].filter((f) => f !== 0));
    const kleur = /rgba\([^)]*\)/.exec(tekst)?.[0];
    expect(genormaliseerd(kleur)).toBe(genormaliseerd(r.voorSchaduw[3]));
  });

  it("elke master laadt het artwork dat de DOM-component ook laadt", () => {
    for (const naam of NAMEN) {
      const r = KAART_MASTERS[naam];
      // De component staat naast zijn stylesheet en importeert dezelfde bron.
      const component = lees(`./${r.css.replace(/\.css$/, ".tsx")}`);
      const bron = /import\s+\w+\s+from\s+"([^"]*-master\.webp)"/.exec(component);
      expect(bron, `${naam}: geen master-import in de component`).not.toBeNull();
      expect(IMPORTS).toContain(bestandsnaam(bron![1]));
    }
  });

  it("een afzonderlijke frontbron wordt ook door de DOM-component geïmporteerd", () => {
    for (const naam of NAMEN) {
      const r = KAART_MASTERS[naam];
      if (!r.voorBron) continue;
      const component = lees(`./${r.css.replace(/\.css$/, ".tsx")}`);
      const front = /import\s+\w+\s+from\s+"([^"]*-front\.webp)"/.exec(
        component,
      );
      expect(front, `${naam}: frontbron ontbreekt in de component`).not.toBeNull();
      expect(IMPORTS).toContain(bestandsnaam(front![1]));
      expect(r.voorMasker).toBeUndefined();
    }
  });
});

describe("masterVoor: de cascade van FutKaart.tsx", () => {
  it("een editie met eigen master wint van de divisie", () => {
    // Een GOAT in vorm draagt de storm, niet zijn monument — de editie is het
    // nieuws van deze week.
    expect(masterVoor("legende", "inform")).toBe("inform");
    expect(masterVoor("dictator", "onfire")).toBe("onfire");
    expect(masterVoor("goud", "pias")).toBe("pias");
  });

  it("zonder editie hangt het master aan de divisie", () => {
    expect(masterVoor("legende", null)).toBe("goat");
    expect(masterVoor("dictator", null)).toBe("dictator");
    expect(masterVoor("platina", null)).toBe("glazenwasser");
    expect(masterVoor("goud", null)).toBe("wannabe");
    expect(masterVoor("zilver", null)).toBe("blaaskaak");
  });

  it("een editie zónder master onderdrukt het divisiemaster (zoals de DOM)", () => {
    // FutKaart.tsx rendert de divisiemasters alleen bij `!editie`: de
    // Kampioen-skin overschrijft het hele vlak, dus de folieranden van de
    // Wannabe horen daar niet meer bij.
    expect(masterVoor("goud", "kampioen")).toBeNull();
    expect(masterVoor("legende", "kampioen")).toBeNull();
  });

  it("de divisies zonder master houden hun vectorkaart", () => {
    for (const tier of ["slof", "karton", "hout", "brons", "diamant", "meester"] as const) {
      expect(masterVoor(tier, null)).toBeNull();
    }
    expect(masterVoor(null, null)).toBeNull();
  });
});

describe("de laagcascade spiegelt FutKaart.tsx", () => {
  const veld = (naam: MasterNaam, k: keyof MasterRegistratie) =>
    Boolean(KAART_MASTERS[naam][k]);

  it("In-Form en On Fire houden hun metalen vinnen", () => {
    // `ornamentLive` in FutKaart.tsx onderdrukt het vector-ornament voor vijf
    // kaarten; de twee weeklens-edities staan er bewust niet bij.
    expect(veld("inform", "onderdruktOrnament")).toBe(false);
    expect(veld("onfire", "onderdruktOrnament")).toBe(false);
    for (const naam of ["bigdaddy", "dictator", "goat", "pias", "piet"] as const)
      expect(veld(naam, "onderdruktOrnament")).toBe(true);
  });

  it("alleen de drie divisiemasters vervangen hun vector-divisiekaart", () => {
    const vervangers = NAMEN.filter((n) => veld(n, "onderdruktDivisie"));
    expect(vervangers.sort()).toEqual(["blaaskaak", "glazenwasser", "wannabe"]);
  });

  it("alleen de storm ligt bóven een ornament dat blijft staan", () => {
    // De On-Fire-crest staat op z-index 4 en dus over zijn eigen master heen;
    // de storm staat op 5 en gaat over alles.
    const boven = NAMEN.filter((n) => veld(n, "voorBovenOrnament"));
    expect(boven).toEqual(["inform"]);
  });
});

/** De bestandsnaam uit een pad. */
function bestandsnaam(pad: string): string {
  return (pad.split("/").pop() ?? "").split("?")[0];
}

/** De bestanden die kaartMasters.ts importeert, op naam. De geïmporteerde
 *  wáárde is hier geen anker: Vite inlinet de kleine maskers als data-URI, dus
 *  van het masker zelf is op runtime geen bestandsnaam meer over. De importregel
 *  in de bron is dat wél. */
const IMPORTS = [
  ...lees("./kaartMasters.ts").matchAll(/from\s+"([^"]+\.(?:webp|svg))"/g),
].map((m) => bestandsnaam(m[1]));

/** Het masker uit een `mask: url(...)`-declaratie; null als de laag er geen
 *  heeft. Bewust alleen `mask`, niet `filter`: de blur-filters in dezelfde
 *  blokken verwijzen óók met url() naar een SVG-fragment. */
function maskerUit(blok: string): string | null {
  const m = /(?:^|\s)mask:\s*url\(["']?([^"')]+)["']?\)/.exec(blok);
  return m ? bestandsnaam(m[1]) : null;
}

/** Het masker uit de CSS moet in de tabel staan — en omgekeerd. De vergelijking
 *  loopt via de importregels in kaartMasters.ts, want de geladen waarde is een
 *  data-URI zonder bestandsnaam. */
function verwachtMasker(css: string | null, tabel: string | undefined) {
  expect(Boolean(css), css ? `CSS maskeert met ${css}` : "CSS maskeert niet").toBe(
    Boolean(tabel),
  );
  if (css) expect(IMPORTS).toContain(css);
}

/** Spaties uit een kleurnotatie, zodat "rgba(2, 4, 10, .78)" en
 *  "rgba(2,4,10,0.78)" hetzelfde lezen. */
function genormaliseerd(kleur: string | undefined): string {
  return (kleur ?? "").replace(/\s+/g, "").replace(/\(\./g, "(0.").replace(/,\./g, ",0.");
}
