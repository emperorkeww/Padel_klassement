import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { kaartSkin, mix, rgba, type KaartEditie } from "./futKaartCanvas";

// De stylesheets als tekst, voor de synctest onderaan. Bewust via node:fs en
// niet via Vite's ?raw: Vitest kortsluit CSS-imports (css: false) op een lege
// string, óók met de raw-query, dus dan zou de test stil niets vergelijken.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const FUT_CSS = lees("../../features/rating/components/FutKaart.css");
const INDEX_CSS = lees("../../app/index.css");

const EDITIES: KaartEditie[] = [
  "icon",
  "kampioen",
  "inform",
  "onfire",
  "pias",
  "piet",
];

describe("mix / rgba", () => {
  it("mixt hexkleuren zoals color-mix(in srgb, a p, b 1-p)", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
    expect(mix("#ff0000", "#00ff00", 1)).toBe("rgb(255, 0, 0)");
    expect(mix("#ff0000", "#00ff00", 0)).toBe("rgb(0, 255, 0)");
  });

  it("slikt zijn eigen uitvoer (#666): een mix van een mix blijft licht", () => {
    // Regressie op de #664-keyline: mix() gaf een rgb()-string terug die de
    // hex-parser als NaN las, waardoor `mix(lijn, "#fff8e8", 0.75)` op élke
    // niet-special poster rgb(64, 62, 58) opleverde — een bijna zwarte lijn.
    const lijn = mix("#3b6ce8", "#a8987a", 0.55);
    expect(lijn).toBe("rgb(108, 128, 183)");
    expect(mix(lijn, "#fff8e8", 0.75)).toBe("rgb(145, 158, 195)");
  });

  it("leest ook rgba() en vervangt de alpha", () => {
    expect(rgba("rgba(240, 199, 102, 0.45)", 0.55)).toBe(
      "rgba(240, 199, 102, 0.55)",
    );
    expect(mix("rgba(255, 255, 255, 0.4)", "#000000", 0.5)).toBe(
      "rgb(128, 128, 128)",
    );
  });

  it("weigert een onbekende notatie i.p.v. stil zwart te tekenen", () => {
    expect(() => mix("rebeccapurple", "#ffffff", 0.5)).toThrow(/notatie/);
  });
});

/** Gemiddelde kanaalwaarde — genoeg om "licht" van "donker" te scheiden.
 *  Slikt beide notaties die de registers gebruiken (hex en rgb/rgba). */
function helderheid(kleur: string): number {
  const kanalen = kleur.startsWith("#")
    ? [
        parseInt(kleur.slice(1, 3), 16),
        parseInt(kleur.slice(3, 5), 16),
        parseInt(kleur.slice(5, 7), 16),
      ]
    : kleur.match(/\d+/g)!.slice(0, 3).map(Number);
  return (kanalen[0] + kanalen[1] + kanalen[2]) / 3;
}

describe("kaartSkin", () => {
  it("kleurt de divisieladder uit de tierkleur", () => {
    const goud = kaartSkin("goud", null);
    expect(goud.kleuren.vlak[0][1]).toBe(mix("#d4a017", "#fdfbf6", 0.2));
    expect(goud.ink).toBe(mix("#d4a017", "#1d1508", 0.52));
    // Zonder editie valt --editie-kleur terug op --kaart-ink.
    expect(goud.editieKleur).toBe(goud.ink);
  });

  it.each([null, "legende" as const, ...EDITIES])(
    "keyline is de lijnkleur op-gemixt naar warm wit (register: %s)",
    (register) => {
      // Dát is wat de keyline ís: color-mix(--kaart-lijn 75%, #fff8e8), dus
      // altijd lichter dan de lijn zelf. Vóór #666 kwam er op de tierkaarten
      // rgb(64, 62, 58) uit — donkerder dan élke lijnkleur.
      const skin =
        register === "legende"
          ? kaartSkin("legende", null)
          : kaartSkin("goud", register);
      expect(helderheid(skin.kleuren.keyline!)).toBeGreaterThan(
        helderheid(skin.lijn),
      );
    },
  );

  it("geeft de special-toptiers hun eigen donkere register", () => {
    expect(kaartSkin("legende", null).kleuren.liner).toBe("#0c0805");
    expect(kaartSkin("dictator", null).kleuren.vlak[0][1]).toBe("#a52347");
  });

  it("laat de editie de kleuren van de divisie overschrijven", () => {
    // Zelfde cascade als de CSS: het editie-blok staat ná het special-blok.
    const iconGoud = kaartSkin("goud", "icon");
    const iconGoat = kaartSkin("legende", "icon");
    expect(iconGoud.kleuren.vlak[0][1]).toBe("#fff6fa");
    expect(iconGoat.kleuren.vlak[0][1]).toBe("#fff6fa");
    expect(iconGoat.ink).toBe("#8c2f5a");
    expect(iconGoat.editieKleur).toBe("#c2447c");
  });

  it("houdt de stralenkrans bij de divisie, niet bij de editie", () => {
    expect(kaartSkin("diamant", null).kleuren.stralen).toBe(true);
    expect(kaartSkin("diamant", "icon").kleuren.stralen).toBe(true);
    expect(kaartSkin("brons", "icon").kleuren.stralen).toBe(false);
    expect(kaartSkin("legende", "inform").kleuren.stralen).toBe(true);
  });

  it("zet bij de schand-edities stralen én satijn uit voor hun eigen weefsel", () => {
    // Spiegel van de `background: none`-regel ná het premium-blok in de CSS.
    const pias = kaartSkin("diamant", "pias");
    const piet = kaartSkin("meester", "piet");
    expect(pias.kleuren.stralen).toBe(false);
    expect(pias.kleuren.textuur).toBe("confetti");
    expect(piet.kleuren.stralen).toBe(false);
    expect(piet.kleuren.textuur).toBe("speelkaart");
    // En geen radiale topgloed: die hebben ze in de CSS niet.
    expect(pias.kleuren.glow).toBe("rgba(255, 255, 255, 0)");
  });

  it("geeft de shimmer-edities hun bredere sheen-baan", () => {
    expect(kaartSkin("goud", "inform").kleuren.sheenSpreiding).toBe(0.12);
    expect(kaartSkin("goud", "onfire").kleuren.sheenSpreiding).toBe(0.12);
    expect(kaartSkin("goud", "kampioen").kleuren.sheenSpreiding).toBeUndefined();
  });
});

/* ----------------------- CSS ↔ canvas-synctest (#666) ---------------------- */

// De kleuren staan twee keer in de codebase: als CSS-tokens (voor de live
// kaart) en als literals hierboven (voor de poster, die bewust niet van de
// live tokens leest — #125). Deze test leest de CSS in en vergelijkt de
// tokendeclaraties, zodat een herijking van een editie niet stil alleen in de
// DOM landt. Bewust beperkt tot de platte tokens: de gradient-stops van
// .fut-kaart__zijde/__vlak betrouwbaar parsen kost meer dan het oplevert —
// die staan met een verwijzing naar dit bestand in FutKaart.css.

/** Waarde van een custom property binnen één CSS-blok, met de
 *  --bigdaddy-*-indirectie van de Icon-editie meteen opgelost. */
function token(blok: string, naam: string): string | null {
  const m = new RegExp(`${naam}:\\s*([^;]+);`).exec(blok);
  if (!m) return null;
  const waarde = m[1].trim();
  const ref = /^var\((--[\w-]+)\)$/.exec(waarde);
  if (!ref) return waarde;
  const root = new RegExp(`${ref[1]}:\\s*([^;]+);`).exec(INDEX_CSS);
  return root ? root[1].trim() : null;
}

/** Het `.fut-kaart--<editie> { … }`-blok met de kleurtokens. */
function editieBlok(editie: KaartEditie): string {
  const m = new RegExp(`\\.fut-kaart--${editie}\\s*\\{([^}]*)\\}`).exec(FUT_CSS);
  expect(m, `blok .fut-kaart--${editie} niet gevonden in FutKaart.css`).not.toBeNull();
  return m![1];
}

describe("editie-registers spiegelen FutKaart.css", () => {
  it.each(EDITIES)("%s: inkt, lijn en editie-kleur", (editie) => {
    const blok = editieBlok(editie);
    const skin = kaartSkin("goud", editie);
    expect(skin.ink).toBe(token(blok, "--kaart-ink"));
    expect(skin.inkSoft).toBe(token(blok, "--kaart-ink-soft"));
    expect(skin.lijn).toBe(token(blok, "--kaart-lijn"));
    expect(skin.editieKleur).toBe(token(blok, "--editie-kleur"));
  });

  it.each(EDITIES)("%s: vlak-gradient (hi/mid/lo)", (editie) => {
    const blok = editieBlok(editie);
    const hi = token(blok, "--kaart-hi");
    // In-Form en On-Fire zetten geen hi/mid/lo: hun vlak staat als literale
    // gradient in de CSS (donkere registers). Die stops blijven handmatig
    // gespiegeld; hier valt er dus niets te vergelijken.
    if (hi == null) return;
    const stops = kaartSkin("goud", editie).kleuren.vlak.map((s) => s[1]);
    expect(stops).toEqual([
      hi,
      token(blok, "--kaart-mid"),
      token(blok, "--kaart-lo"),
    ]);
  });

  it("dekt élke editie die FutKaart.css kleurt", () => {
    // Vangnet voor een zévende editie: als de CSS er een bijkrijgt zonder dat
    // de canvas-tabel meegroeit, valt dat hier op i.p.v. op de poster.
    const gevonden = new Set(
      [...FUT_CSS.matchAll(/\.fut-kaart--([a-z]+)\s*\{[^}]*--editie-kleur:/g)].map(
        (m) => m[1],
      ),
    );
    expect([...gevonden].sort()).toEqual([...EDITIES].sort());
  });
});