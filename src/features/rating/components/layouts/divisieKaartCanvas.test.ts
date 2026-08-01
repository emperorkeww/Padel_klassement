import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { DIVISIE_TEKST, type TekstStijl } from "./divisieKaartCanvas";
import { BALLENRAPER_LAYOUT } from "./divisieLayouts";
import { SLOF_LAYOUT } from "../slof/slofLayout";
import type { DivisieKaartLayout } from "./kaartLayout";

// De zetting van de twee full-bleed divisiekaarten staat op twee plekken: als
// CSS onder `.divisie-voorkant…` (voor de DOM) en als register in
// divisieKaartCanvas.ts (voor de poster). De geometrie is wél gedeeld — die
// komt uit dezelfde `DivisieKaartLayout` — dus alleen kleur, korps, gewicht en
// spatiering worden hier bewaakt. Zelfde patroon als kaartMasters.test.ts.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");

const LAYOUTS: ReadonlyArray<readonly [string, DivisieKaartLayout]> = [
  ["ballenraper", BALLENRAPER_LAYOUT],
  ["slof", SLOF_LAYOUT],
];

/** Het CSS-blok van één zone, binnen de klasse die dit register overschrijft.
 *  Het basisregister (Ballenraper) staat in DivisieVoorkant.css zonder eigen
 *  klasse; de slof hangt alles onder `.divisie-voorkant--slof`. */
function zoneBlok(css: string, klasse: string | undefined, zone: string): string {
  const prefix = klasse ? `\\.${klasse.replace(/[.]/g, "\\.")}\\s+` : "";
  const m = new RegExp(
    `${prefix}\\.divisie-voorkant__${zone}\\s*\\{([^}]*)\\}`,
  ).exec(css);
  return m ? m[1] : "";
}

/** `font-size: calc(var(--fut-kw) * 0.205)` → 0.205. */
function korpsUit(blok: string): number | null {
  const m = /font-size:\s*calc\(var\(--fut-kw\)\s*\*\s*([\d.]+)\)/.exec(blok);
  return m ? Number(m[1]) : null;
}

function waardeUit(blok: string, eigenschap: string): string | null {
  const m = new RegExp(`(?:^|[\\s;])${eigenschap}:\\s*([^;]+);`).exec(blok);
  return m ? m[1].trim() : null;
}

/** Vergelijkt één zone met zijn CSS. Ontbreekt de eigenschap in het blok, dan
 *  erft de zone hem van het basisregister en valt er niets te vergelijken. */
function verwachtStijl(blok: string, stijl: TekstStijl, naam: string) {
  const korps = korpsUit(blok);
  expect(korps, `${naam}: font-size ontbreekt in de CSS`).not.toBeNull();
  expect(korps).toBeCloseTo(stijl.korps, 6);

  const kleur = waardeUit(blok, "color");
  if (kleur) expect(kleur.toLowerCase(), `${naam}: kleur`).toBe(stijl.kleur);

  const gewicht = waardeUit(blok, "font-weight");
  if (gewicht) expect(Number(gewicht), `${naam}: gewicht`).toBe(stijl.gewicht);

  const spatiering = waardeUit(blok, "letter-spacing");
  if (spatiering)
    expect(Number(spatiering.replace("em", "")), `${naam}: spatiering`).toBeCloseTo(
      stijl.spatiering ?? 0,
      6,
    );

  const transform = waardeUit(blok, "text-transform");
  expect(transform === "uppercase", `${naam}: hoofdletters`).toBe(
    Boolean(stijl.hoofdletters),
  );
}

describe("divisieKaartCanvas ↔ de CSS van de kaart (#895)", () => {
  it.each(LAYOUTS.map(([naam]) => naam))(
    "%s: elke tekstzone deelt kleur, korps en gewicht",
    (naam) => {
      const register = DIVISIE_TEKST[naam];
      // De `css`-paden staan relatief aan de componentenmap, deze test aan
      // layouts/ — vandaar de stap omhoog.
      const css = lees(`../${register.css}`);
      const blok = (zone: string) => zoneBlok(css, register.klasse, zone);
      verwachtStijl(blok("rating"), register.rating, `${naam}/rating`);
      verwachtStijl(blok("subniveau"), register.subniveau, `${naam}/subniveau`);
      verwachtStijl(blok("titel"), register.titel, `${naam}/titel`);
      verwachtStijl(
        blok("stat-label"),
        register.statLabel,
        `${naam}/stat-label`,
      );
      verwachtStijl(
        blok("stat-waarde"),
        register.statWaarde,
        `${naam}/stat-waarde`,
      );
    },
  );

  it("de emoji-zone deelt zijn korps", () => {
    // Alleen de slof zet hem apart; de Ballenraper toont geen emoji-zone.
    const slof = DIVISIE_TEKST.slof;
    const css = lees(`../${slof.css}`);
    expect(korpsUit(zoneBlok(css, slof.klasse, "emoji"))).toBeCloseTo(
      slof.emoji.korps,
      6,
    );
  });

  it("de slof verbergt zijn naam in beeld, de Ballenraper niet", () => {
    // `.divisie-voorkant--slof .divisie-voorkant__naam` is een sr-only-blok:
    // 1px groot en weggeklipt. Een poster heeft geen schermlezer, dus daar
    // vervalt de zone helemaal.
    const css = lees(`../${DIVISIE_TEKST.slof.css}`);
    const blok = zoneBlok(css, DIVISIE_TEKST.slof.klasse, "naam");
    expect(blok).toContain("clip-path: inset(50%)");
    expect(DIVISIE_TEKST.slof.naam).toBeUndefined();
    expect(DIVISIE_TEKST.ballenraper.naam).toBeDefined();
  });

  it("de statvorm volgt de flex-richting van de CSS", () => {
    const slofCss = lees(`../${DIVISIE_TEKST.slof.css}`);
    // `flex-direction: column` op het statblok = zes regels onder elkaar.
    expect(zoneBlok(slofCss, DIVISIE_TEKST.slof.klasse, "stats")).toContain(
      "flex-direction: column",
    );
    expect(DIVISIE_TEKST.slof.statVorm).toBe("regels");
    // De Ballenraper laat het basisblok staan: vijf kolommen naast elkaar.
    expect(DIVISIE_TEKST.ballenraper.statVorm).toBe("kolommen");
  });

  it("elke layout met een eigen compositie heeft ook een zetting", () => {
    // Anders tekent de poster wél het artwork en niet de cijfers erop.
    for (const [naam, layout] of LAYOUTS) {
      expect(DIVISIE_TEKST[layout.id], naam).toBeDefined();
      expect(layout.id).toBe(naam);
    }
  });

  it("het aantal statregels past bij de vorm", () => {
    // De regel-variant verdeelt de zonehoogte over zijn regels; bij de
    // kolom-variant deelt hij de breedte. Een layout die zijn statlijst
    // verdubbelt zonder de zone mee te laten groeien wordt onleesbaar, dus dit
    // legt de huidige verhouding vast.
    expect(SLOF_LAYOUT.statistieken).toHaveLength(6);
    expect(BALLENRAPER_LAYOUT.statistieken).toHaveLength(5);
  });
});
