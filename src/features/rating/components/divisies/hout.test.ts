import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { ORNAMENT_VIEWBOX } from "../futKaartOrnamenten";
import { DIVISIE_HOUT } from "./hout";
import type { DivisieDeel } from "./divisieKaart";

// Het register van "Ballenraper" leeft op twee plekken: als CSS-tokens in
// hout.css (de kaart in de DOM) en als `register` in hout.ts (dezelfde kaart op
// de deel-poster). Deze test leest de stylesheet als tekst in en houdt de twee
// gelijk; lopen ze uiteen, dan wijkt de export af van wat de speler ziet.
// Bewust via node:fs en niet via Vite's ?raw: Vitest kortsluit CSS-imports
// (css: false) op een lege string, óók met de raw-query — dan zou de test stil
// niets vergelijken. Zelfde regime als de synctests van de andere divisies. Het
// pad loopt via een parameter omdat Vite een letterlijke
// `new URL("./x", import.meta.url)` herschrijft naar een asset-URL: dan komt er
// geen file:-scheme meer uit en faalt fileURLToPath.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const HOUT_CSS = lees("./hout.css");
const KAAL = HOUT_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
/** Alleen het commentaar, voor de contrastmeting die daarin gedocumenteerd is. */
const COMMENTAAR = HOUT_CSS.match(/\/\*[\s\S]*?\*\//g)!.join("\n");

const REGISTER = DIVISIE_HOUT.register!;
const MOTIEF = DIVISIE_HOUT.motief!;
const ALLE_DELEN: readonly DivisieDeel[] = [
  ...(DIVISIE_HOUT.achter ?? []),
  ...(DIVISIE_HOUT.voor ?? []),
];

/* -------------------------------- parsers -------------------------------- */

/** Alle coördinaten uit een pad-string, als [x, y]-paren. De divisie schrijft
 *  bewust alleen M/L/C met absolute getallen (geen A-commando's), dus elk
 *  getallenpaar is écht een punt. */
function punten(pad: string): [number, number][] {
  expect(pad, `relatief of boog-commando in ${pad.slice(0, 40)}…`).not.toMatch(
    /[AaHhVvSsQqTtmlc]/,
  );
  const getallen = pad.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  expect(getallen.length % 2, `oneven aantal getallen in ${pad.slice(0, 40)}…`).toBe(
    0,
  );
  const uit: [number, number][] = [];
  for (let i = 0; i + 1 < getallen.length; i += 2)
    uit.push([getallen[i], getallen[i + 1]]);
  return uit;
}

function grenzen(paden: readonly string[]) {
  const p = paden.flatMap(punten);
  return {
    xMin: Math.min(...p.map((q) => q[0])),
    xMax: Math.max(...p.map((q) => q[0])),
    yMin: Math.min(...p.map((q) => q[1])),
    yMax: Math.max(...p.map((q) => q[1])),
  };
}

/** Eén CSS-blok, ontdaan van commentaar — anders leest een regex een kleur uit
 *  de toelichting i.p.v. uit de declaratie. */
function blok(selector: string): string {
  const m = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(KAAL);
  expect(m, `blok ${selector} ontbreekt in hout.css`).not.toBeNull();
  return m![1];
}

function token(naam: string): string {
  const m = new RegExp(`${naam}:\\s*([^;]+);`).exec(blok(".fut-kaart--hout"));
  expect(m, `${naam} ontbreekt in .fut-kaart--hout`).not.toBeNull();
  return m![1].replace(/\s+/g, " ").trim();
}

/* ----------------------------- contrastmeting ----------------------------- */

// WCAG 2.1 relatieve luminantie en contrastverhouding, plus het compositen van
// de motief-ets op het vlak. Staat hier en niet in een helper omdat harde eis 4
// van #710 juist een gedocumenteerde méting vraagt: de test rekent hem na én
// controleert dat het getal in het CSS-commentaar hetzelfde is.
const kanaal = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminantie = (hex: string) => {
  const [r, g, b] = rgb(hex).map((c) => kanaal(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const verhouding = (a: string, b: string) => {
  const [licht, donker] = [luminantie(a), luminantie(b)].sort((p, q) => q - p);
  return (licht + 0.05) / (donker + 0.05);
};
/** `boven` met dekking `alpha` over `onder` — dezelfde rekening als de browser
 *  voor een halfdoorzichtige motieflaag. */
const opElkaar = (onder: string, boven: string, alpha: number) =>
  "#" +
  rgb(onder)
    .map((v, i) =>
      Math.round(v * (1 - alpha) + rgb(boven)[i] * alpha)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
/** Nederlandse notatie met twee decimalen, zoals in het CSS-commentaar. */
const nl = (n: number) => n.toFixed(2).replace(".", ",");

/* ------------------------------- geometrie ------------------------------- */

describe("Ballenraper-ornament (#710)", () => {
  it("bevat geen enkele NaN — ook niet in de berekende delen", () => {
    // Het vlechtwerk, de streepjesbanen en de korrels komen uit
    // deelberekeningen (kruispuntdeling, cubic-sampling, een LCG). Eén deling
    // door nul en het pad wordt stil onzichtbaar i.p.v. te crashen.
    for (const { d } of ALLE_DELEN)
      expect(d, `NaN in ${d.slice(0, 48)}…`).not.toMatch(/NaN/);
    for (const { d } of MOTIEF.paden)
      expect(d, `NaN in motief ${d.slice(0, 48)}…`).not.toMatch(/NaN/);
  });

  it("past binnen de ornament-viewBox, ook ná spiegeling", () => {
    // De ornamentlaag is de énige die buiten de schildclip valt; loopt een pad
    // buiten de viewBox, dan snijdt de browser hem stil af — en dan verdwijnt
    // precies het uitsteeksel dat de divisie herkenbaar maakt.
    const [vx, vy, vw, vh] = ORNAMENT_VIEWBOX.split(" ").map(Number);
    const g = grenzen(ALLE_DELEN.map((d) => d.d));
    expect(Math.min(g.xMin, 100 - g.xMax)).toBeGreaterThan(vx);
    expect(Math.max(g.xMax, 100 - g.xMin)).toBeLessThan(vx + vw);
    expect(g.yMin).toBeGreaterThan(vy);
    expect(g.yMax).toBeLessThan(vy + vh);
  });

  it("houdt de gespiegelde delen links van de as", () => {
    // `spiegel` tekent hetzelfde pad nóg eens om x=50. Een deel dat de as al
    // zelf passeert, botst met zijn eigen spiegelbeeld: netstroken die elkaar
    // kruisen, een balnaad die dwars over de bal loopt.
    const gespiegeld = ALLE_DELEN.filter((d) => d.spiegel);
    expect(gespiegeld.length).toBeGreaterThan(0);
    for (const deel of gespiegeld)
      expect(
        grenzen([deel.d]).xMax,
        `${deel.d.slice(0, 40)}… kruist de as`,
      ).toBeLessThan(50);
  });

  it("zet de delen óp de as symmetrisch neer", () => {
    // Crest en mand staan op x=50 en spiegelen daarom niet: ze bouwen hun
    // symmetrie in het pad zelf (de generatoren rekenen met 50 ± halve
    // breedte). Anders hangt de mand scheef in een kaart waar verder alles in
    // het midden staat. Het vlechtwerk over de mandrand bestaat uit losse
    // schuine strengen en is alleen als reeks symmetrisch — vandaar zowel de
    // meting op de hele groep als die op de gesloten vormen.
    const opDeAs = ALLE_DELEN.filter((d) => !d.spiegel);
    const g = grenzen(opDeAs.map((d) => d.d));
    expect(g.xMin + g.xMax).toBeCloseTo(100, 1);
    for (const deel of opDeAs.filter((d) => d.vulling)) {
      const b = grenzen([deel.d]);
      expect(
        b.xMin + b.xMax,
        `${deel.d.slice(0, 40)}… staat scheef`,
      ).toBeCloseTo(100, 1);
    }
  });

  it("laat de crest boven de bovenrand uitkomen en onder de inkt blijven", () => {
    // Hele punt van de `voor`-laag: deze vormen liggen vóór de kaart omdat ze
    // over de rand heen horen te vallen. Blijft alles binnen het schild, dan
    // had het net zo goed achter de kaart gekund en is de extra laag zinloos.
    // En de onderkant moet boven het eloblok blijven, dat rond v=16 begint.
    const crest = ALLE_DELEN.filter((d) => grenzen([d.d]).yMin < 0);
    expect(crest.length).toBeGreaterThan(4);
    const g = grenzen(crest.map((d) => d.d));
    expect(g.yMin).toBeLessThan(-10);
    expect(g.yMax).toBeGreaterThan(0);
    expect(g.yMax).toBeLessThan(14);
  });

  it("laat de mand uit de schildpunt hangen en onder de divisieregel blijven", () => {
    // Op v=134 loopt de schildrand van u≈41,7 tot u≈58,3; is de mand daar niet
    // breder, dan zit hij netjes ín de punt en had hij in het motief gekund.
    // Bovenaan is het omgekeerde de eis: het vlak zet zijn laatste tekstregel
    // tot v≈115 (24% bodempadding), dus de mandrand mag daar niet boven komen.
    const mand = DIVISIE_HOUT.voor!.filter((d) =>
      /url\(#fut-div-hout-mand\)/.test(d.vulling ?? ""),
    );
    expect(mand.length).toBe(2); // trog en rand
    const g = grenzen(mand.map((d) => d.d));
    expect(g.xMin).toBeLessThan(41.7);
    expect(g.xMax).toBeGreaterThan(58.3);
    expect(g.yMin).toBeGreaterThan(115);
    expect(g.yMax).toBeLessThan(139 + 8);
  });

  it("houdt het bij één tennisbal, en die is het enige groene accent", () => {
    // Stijlbeperking uit de referentie: niet overal losse ballen, maar één
    // duidelijke groene accentbal. Meetbaar: precies één deel draagt de
    // bal-gradient, en geen andere gradient of contour is groen (groen = een
    // g-kanaal dat boven r én b uitkomt).
    const groen = (kleur: string) => {
      const m = /#([0-9a-f]{6})/i.exec(kleur);
      if (!m) return false;
      const [r, g, b] = rgb(`#${m[1]}`);
      return g > r && g > b;
    };
    const balDelen = ALLE_DELEN.filter(
      (d) => d.vulling === "url(#fut-div-hout-bal)",
    );
    expect(balDelen).toHaveLength(1);
    const groeneGradienten = (DIVISIE_HOUT.gradienten ?? []).filter((g) =>
      g.stops.some(([, kleur]) => groen(kleur)),
    );
    expect(groeneGradienten.map((g) => g.id)).toEqual(["fut-div-hout-bal"]);
    // De contour van de bal mag mee-vergroenen; verder niets op de kaart.
    const groeneContouren = ALLE_DELEN.filter((d) => groen(d.contour ?? "")).length;
    expect(groeneContouren).toBe(1);
  });

  it("vlecht de netstrook echt: de onderliggende strengen zijn onderbroken", () => {
    // Twee families die elkaar ongehinderd kruisen leest als gaas; een vlecht
    // ontstaat pas doordat de onderliggende familie bij élke kruising een gat
    // krijgt. Meetbaar aan het aantal subpaden: minder strengen, méér stukken.
    const koorden = DIVISIE_HOUT.achter!.filter((d) => !d.vulling && d.spiegel);
    const [onder, over] = koorden;
    const stukken = (d: string) => (d.match(/M /g) ?? []).length;
    expect(stukken(over.d)).toBeGreaterThan(6);
    expect(stukken(onder.d)).toBeGreaterThan(stukken(over.d) * 2);
    // En de strook komt écht naast de kaart uit (u=0 is de flank tot v≈83).
    expect(grenzen([over.d]).xMin).toBeLessThan(-5);
  });

  it("verwijst alleen naar gradients die deze divisie zelf meebrengt", () => {
    const ids = new Set((DIVISIE_HOUT.gradienten ?? []).map((g) => g.id));
    for (const id of ids) expect(id.startsWith("fut-div-hout-")).toBe(true);
    for (const deel of ALLE_DELEN) {
      const ref = /^url\(#(.+)\)$/.exec(deel.vulling ?? "");
      if (ref) expect(ids.has(ref[1]), `onbekende gradient ${ref[1]}`).toBe(true);
    }
  });

  it("houdt het watermerk binnen zijn eigen 100×100-viewBox", () => {
    // Het motief heeft een andere doos dan de ornamentlaag (FutKaartMotief
    // rendert op "0 0 100 100"); een baan die eruit loopt, wordt afgesneden
    // i.p.v. mee-geschaald.
    const g = grenzen(MOTIEF.paden.map((p) => p.d));
    expect(g.xMin).toBeGreaterThanOrEqual(0);
    expect(g.xMax).toBeLessThanOrEqual(100);
    expect(g.yMin).toBeGreaterThanOrEqual(0);
    expect(g.yMax).toBeLessThanOrEqual(100);
  });

  it("laat élke balbaan onderin het midden uitkomen — naar de mand toe", () => {
    // De banen zijn er om naar de mand te wíjzen; een baan die halverwege naar
    // links wegdraait maakt er een decoratieve waaier van. De streepjes staan
    // los in één laag, dus "de baan" is hier het laatste streepje van elke
    // reeks: dat is het punt dat de blik naar de kaartpunt stuurt.
    const banen = MOTIEF.paden.filter((p) => p.soort === "lijn" && p.breedte === 1.3);
    expect(banen.length).toBeGreaterThan(24);
    const eindpunten = banen
      .map((p) => punten(p.d).at(-1)!)
      .filter(([, y]) => y > 88);
    expect(eindpunten).toHaveLength(4);
    for (const [x, y] of eindpunten) {
      expect(x).toBeGreaterThan(42);
      expect(x).toBeLessThan(58);
      expect(y).toBeGreaterThan(88);
    }
  });
});

/* ------------------------------ CSS ↔ register ------------------------------ */

describe("het hout-register spiegelt hout.css", () => {
  it("vlak-, inkt- en lijntokens", () => {
    expect([token("--kaart-hi"), token("--kaart-mid"), token("--kaart-lo")]).toEqual(
      [...REGISTER.vlak],
    );
    expect(token("--kaart-ink")).toBe(REGISTER.ink);
    expect(token("--kaart-ink-soft")).toBe(REGISTER.inkSoft);
    expect(token("--kaart-lijn")).toBe(REGISTER.lijn);
  });

  it("frame, liner en keyline", () => {
    const stops = [
      ...blok(".fut-kaart--hout .fut-kaart__zijde").matchAll(
        /(#[0-9a-f]{6})\s+([\d.]+)%/g,
      ),
    ].map(([, kleur, pct]) => [Number(pct) / 100, kleur]);
    expect(stops).toEqual(REGISTER.frame.map((s) => [...s]));
    expect(blok(".fut-kaart--hout .fut-kaart__liner").match(/#[0-9a-f]{6}/i)![0]).toBe(
      REGISTER.liner,
    );
    expect(
      blok(".fut-kaart--hout .fut-kaart__keyline").match(/#[0-9a-f]{6}/i)![0],
    ).toBe(REGISTER.keyline);
  });

  it("topgloed en vlak-gradient", () => {
    // De gloed zit in de background-shorthand en heeft dus geen eigen token;
    // wie hem herijkt, moet de hele regel aanraken. Deze assertie vangt af dat
    // dat alleen in de DOM gebeurt.
    const vlak = blok(".fut-kaart--hout .fut-kaart__vlak");
    expect(/radial-gradient\([\s\S]*?,\s*(rgba\([^)]*\))/.exec(vlak)![1]).toBe(
      REGISTER.glow,
    );
    // De middenstop blijft op de canvas-default (0,56); staat er iets anders,
    // dan hoort `vlakMid` in het register te staan.
    expect(REGISTER.vlakMid).toBeUndefined();
    expect(Number(/var\(--kaart-mid\)\s+(\d+)%/.exec(vlak)![1]) / 100).toBeCloseTo(
      0.56,
      5,
    );
  });

  it("sheen-baan en satijn, en geen stralenkrans", () => {
    const baan =
      /transparent (\d+)%,\s*(rgba\([^)]*\)) 50%,\s*transparent (\d+)%/.exec(
        blok(".fut-kaart--hout .fut-kaart__vlak::before"),
      )!;
    expect(baan[2]).toBe(REGISTER.sheen);
    // sheenSpreiding is de halve breedte van de baan rond 50%.
    expect(Number(baan[1]) / 100).toBeCloseTo(0.5 - REGISTER.sheenSpreiding!, 5);
    expect(Number(baan[3]) / 100).toBeCloseTo(0.5 + REGISTER.sheenSpreiding!, 5);

    const satijn = blok(".fut-kaart--hout .fut-kaart__vlak::after");
    expect(Number(/rgba\(255, 255, 255, ([\d.]+)\)/.exec(satijn)![1])).toBe(
      REGISTER.satijnAlpha,
    );
    // De canvas-satijnlijn is hardgecodeerd wit; een warm getinte ::after zou
    // hier stil van de poster afwijken.
    expect(satijn).toContain("rgba(255, 255, 255,");
    // Geen stralenkrans: die zou als repeating-conic-gradient in dit ::after
    // staan (zie het premium-blok in FutKaart.css).
    expect(satijn).not.toContain("conic");
    expect(REGISTER.stralen).toBe(false);
    // En geen textuur-override: deze kaart blijft op het gedeelde satijn.
    expect(REGISTER.textuur).toBeUndefined();
  });

  it("echo en binnenlijnen", () => {
    const echo = token("--kaart-echo");
    const [dx, dy, kleur] = REGISTER.echo![0];
    // dx = 0: een plank ligt plat, dus de echo staat recht onder het schild.
    expect(dx).toBe(0);
    expect(echo).toContain(`drop-shadow(0 calc(var(--fut-kw) * ${dy})`);
    expect(echo).toContain(kleur);
    const binnenlijn = token("--kaart-binnenlijn");
    for (const [spreiding, lijnKleur] of REGISTER.binnenlijn!)
      expect(binnenlijn).toContain(`inset 0 0 0 ${spreiding}px ${lijnKleur}`);
  });

  it("blijft van de andere kaartvarianten af en op specificiteit 0,1,0", () => {
    // Elke regel in dit bestand hoort op .fut-kaart--hout te staan; een selector
    // zonder die klasse zou stil ook Bankvuller of de GOAT hertinten. En de
    // dubbele basisklasse is voorbehouden aan de editieregisters (#710): die
    // moeten van de divisie kunnen winnen wanneer beide op dezelfde kaart staan.
    const selectors = [...KAAL.matchAll(/([^{}]+)\{/g)]
      .map((m) => m[1].replace(/\s+/g, " ").trim())
      .filter((s) => !s.startsWith("@") && !/^[\d%,\s]+$/.test(s));
    expect(selectors.length).toBeGreaterThan(5);
    for (const selector of selectors) {
      expect(selector, `selector zonder --hout: ${selector}`).toContain(
        ".fut-kaart--hout",
      );
      expect(selector, `dubbele basisklasse: ${selector}`).not.toContain(
        ".fut-kaart.fut-kaart--hout",
      );
    }
    // Vaste hexen, geen thema-afhankelijke tokens: de deel-poster staat op het
    // lichte palet vastgepind (#125), dus color-mix op --tier zou DOM en poster
    // in het donkere thema uiteen laten lopen.
    expect(KAAL).not.toContain("color-mix");
    expect(KAAL).not.toContain("var(--tier)");
  });

  it("staat stil: geen animatie, in geen van beide bewegingsvoorkeuren", () => {
    // Bewuste keuze (zie de kop van hout.css): een bewegende glansbaan maakt van
    // gereedschap een trofee. Zolang er niets beweegt, hoeft er ook niets achter
    // prefers-reduced-motion — maar komt er ooit beweging bij, dan moet die daar
    // wél achter, en dan valt deze test om als vangnet.
    expect(HOUT_CSS).not.toContain("animation");
    expect(HOUT_CSS).not.toContain("@keyframes");
  });
});

/* ------------------------- contrast (harde eis 4) ------------------------- */

describe("de gedocumenteerde contrastmeting klopt", () => {
  const lo = REGISTER.vlak[2];

  it("inkt en zachte inkt halen AA op de donkerste vlak-stop", () => {
    // Reden dat deze divisie aan de beurt was: op de generieke metaalladder werd
    // de divisietitel grijs-op-grijs. De ongunstigste plek van het vlak is de
    // donkerste stop, want de inkt is hier donker en het vlak loopt naar onderen
    // weg — vandaar dat dít de maat is.
    expect(verhouding(REGISTER.ink, lo)).toBeGreaterThanOrEqual(4.5);
    expect(verhouding(REGISTER.inkSoft, lo)).toBeGreaterThanOrEqual(4.5);
    // En hairlines boven de 3:1 voor niet-tekstuele elementen.
    expect(verhouding(REGISTER.lijn, lo)).toBeGreaterThanOrEqual(3);
  });

  it("de motief-ets duwt de zachte inkt niet onder AA", () => {
    // Het watermerk ligt ónder de inkt maar wel bóven het vlak, dus het verlaagt
    // de achtergrond lokaal. Slechtste geval: een balbaan op volle laagsterkte
    // over de donkerste stop, mét een slijtplek eronder. Dit is de rekening
    // waaraan de alpha's in hout.ts vastzitten.
    const alpha = Number(/,\s*([\d.]+)\)$/.exec(MOTIEF.kleur)![1]);
    const ets = /^rgba?\((\d+), (\d+), (\d+)/
      .exec(MOTIEF.kleur)!
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("");
    const plek = Math.max(
      ...MOTIEF.paden.filter((p) => p.soort === "vlak").map((p) => p.alpha ?? 1),
    );
    const baan = opElkaar(lo, `#${ets}`, alpha);
    const samen = opElkaar(lo, `#${ets}`, 1 - (1 - alpha) * (1 - alpha * plek));
    expect(verhouding(REGISTER.inkSoft, baan)).toBeGreaterThanOrEqual(4.5);
    expect(verhouding(REGISTER.inkSoft, samen)).toBeGreaterThanOrEqual(4.5);
  });

  it("staat met dezelfde getallen in het CSS-commentaar", () => {
    // Harde eis 4 van #710 vraagt de gemeten ratio ín het commentaar. Een
    // getal dat daar níet meer klopt is erger dan geen getal, dus reken het na:
    // wie het palet bijstelt, moet ook de toelichting bijwerken.
    for (const stop of REGISTER.vlak)
      for (const inkt of [REGISTER.ink, REGISTER.inkSoft]) {
        const gemeten = nl(verhouding(inkt, stop));
        expect(
          COMMENTAAR,
          `${gemeten}:1 (${inkt} op ${stop}) ontbreekt in het commentaar`,
        ).toContain(`${gemeten}:1`);
      }
    // En de hex-waarden zelf staan er ook bij, zodat de meting navolgbaar is.
    for (const kleur of [REGISTER.ink, REGISTER.inkSoft, REGISTER.lijn, ...REGISTER.vlak])
      expect(COMMENTAAR).toContain(kleur);
  });
});

describe("de divisietitel past op de veldmaat", () => {
  it("Ballenraper III blijft binnen de langste regel die de zetting al aankan", () => {
    // De compact-zetting in FutKaart.css is gekalibreerd op de langste
    // divisietitel van de negen ("Sletje van de baan III"). Zolang deze titel
    // korter is, kan hij op 116px niet als eerste gaan ellipsen — een
    // hernoeming naar iets langers zou dat stil wél doen.
    const langste = `${DIVISIE_HOUT.naam} III`;
    expect(langste).toBe("Ballenraper III");
    expect(langste.length).toBeLessThan("Sletje van de baan III".length);
  });
});
