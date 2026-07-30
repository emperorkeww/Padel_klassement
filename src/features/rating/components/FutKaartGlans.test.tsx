import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { FutKaart, type FutEditie } from "@/features/rating/components/FutKaart";
import {
  glansVertraging,
  premiumGlans,
} from "@/features/rating/components/premiumGlans";
import { tierFor } from "@/features/rating/tiers";

// De stylesheet als tekst: Vitest kortsluit CSS-imports op een lege string
// (css: false), óók met ?raw, dus de tokens moeten via node:fs gelezen worden.
// Het pad gaat als variábele naar `new URL`: bij een letterlijke string herkent
// Vite het asset-idioom en herschrijft het naar een http://-dev-server-URL,
// waarna fileURLToPath afketst op het schema.
const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const CSS = lees("./FutKaart.css");

// De vier premium kaarten (#773) met de rating waarop ze verschijnen. Big Daddy
// en Kampioen zijn edities, de GOAT en El Padelissimo toptiers — vandaar de twee
// verschillende manieren om ze aan te zetten.
const PREMIUM: ReadonlyArray<{
  naam: string;
  rating: number;
  editie: FutEditie | null;
  modifier: string;
}> = [
  { naam: "Big Daddy", rating: 1084, editie: "icon", modifier: "fut-kaart--icon" },
  {
    naam: "Kampioen",
    rating: 1084,
    editie: "kampioen",
    modifier: "fut-kaart--kampioen",
  },
  { naam: "GOAT", rating: 1450, editie: null, modifier: "fut-kaart--legende" },
  {
    naam: "El Padelissimo",
    rating: 1650,
    editie: null,
    modifier: "fut-kaart--dictator",
  },
];

const kaart = (rating: number, editie: FutEditie | null, zaad?: string) => {
  const { container } = render(
    <FutKaart
      tier={tierFor(rating)}
      editie={editie}
      glansZaad={zaad}
      voor={<span className="fut-kaart__naam">Alice</span>}
    />,
  );
  return container.querySelector<HTMLElement>(".fut-kaart")!;
};
const glansVan = (el: HTMLElement) =>
  el.querySelector<HTMLElement>(".fut-kaart__glans");

// Alle blokken uit de CSS als [selector, body]-paren, commentaar weggeknipt.
const regels = (() => {
  const schoon = CSS.replace(/\/\*[\s\S]*?\*\//g, " ");
  return [...schoon.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
    (m) => [m[1].replace(/\s+/g, " ").trim(), m[2]] as const,
  );
})();
const blok = (selector: string) =>
  regels.find(([s]) => s === selector)?.[1] ?? "";
const token = (selector: string, naam: string) =>
  new RegExp(`${naam}:\\s*([^;]+);`).exec(blok(selector))?.[1].trim() ?? "";

describe("premium glans: de laag zelf (#773)", () => {
  it.each(PREMIUM)("$naam krijgt een glanslaag", ({ rating, editie }) => {
    const laag = glansVan(kaart(rating, editie));
    expect(laag).not.toBeNull();
    // Puur decoratief: geen kaartgegevens, dus onzichtbaar voor een
    // screenreader — de issue vraagt expliciet géén extra voorleestekst.
    expect(laag).toHaveAttribute("aria-hidden", "true");
    expect(laag!.textContent).toBe("");
  });

  it("een gewone kaart krijgt géén glanslaag", () => {
    // Zonder deze grens zou elke divisiekaart een lege laag en een
    // IntersectionObserver meeslepen voor een effect dat de CSS niet tekent.
    expect(glansVan(kaart(784, null))).toBeNull();
    expect(glansVan(kaart(984, null))).toBeNull();
  });

  it("de laag zit ín het vlak, ná randwaas en motief en vóór de inhoud", () => {
    // Deze plek in de DOM is wat de stapeling waarmaakt: het vlak is door zijn
    // clip-path een stacking context, dus de glans (z-index −1) ligt bóven het
    // motief dat eerder staat, en ónder alle inkt. Verschuift de laag naar
    // buiten het vlak, dan valt hij buiten de kaartmaskering.
    const el = kaart(1450, null);
    const vlak = el.querySelector(".fut-kaart__vlak")!;
    // getAttribute en niet .className: het motief is een <svg>, en daar is
    // className een SVGAnimatedString in plaats van een string.
    const kinderen = [...vlak.children].map((k) => k.getAttribute("class"));
    expect(kinderen).toEqual([
      "fut-kaart__randwaas",
      expect.stringContaining("fut-kaart__motief"),
      "fut-kaart__glans",
      // De binnenlaag van het GOAT-mastereffect hoort hier ook: ná de glans,
      // vóór de inhoud. Beide liggen op z-index −1 binnen dezelfde clip, dus
      // de DOM-volgorde bepaalt dat de bergscene bóven de glans schildert en
      // de inkt bóven allebei.
      expect.stringContaining("goat-effect--binnen"),
      "fut-kaart__naam",
    ]);
  });
});

describe("premium glans: voorrang van de tijdelijke overlays (#773)", () => {
  // Eis 7 en 8: On Fire en In-Form zijn tijdelijke statusoverlays en houden de
  // visuele voorrang. De permanente glans blijft staan (het materiaal mag niet
  // plat worden) maar verliest zijn beweging via --gedempt.
  it.each(["inform", "onfire"] as const)(
    "een GOAT met %s dempt zijn permanente glans",
    (editie) => {
      const laag = glansVan(kaart(1450, editie))!;
      expect(laag).not.toBeNull();
      expect(laag.className).toContain("fut-kaart__glans--gedempt");
    },
  );

  it("de cascade zelf: editie boven tier, overlay dempt", () => {
    // Direct op de mapping, los van de DOM: een editie met eigen glans wint van
    // de tier-glans (Big Daddy op een GOAT blijft Big Daddy), en een tijdelijke
    // overlay laat de tier-glans staan maar dempt hem.
    expect(premiumGlans("icon", "meester")).toEqual({
      variant: "bigdaddy",
      gedempt: false,
    });
    expect(premiumGlans("icon", "legende")).toEqual({
      variant: "bigdaddy",
      gedempt: false,
    });
    expect(premiumGlans(null, "legende")).toEqual({
      variant: "goat",
      gedempt: false,
    });
    expect(premiumGlans("inform", "legende")).toEqual({
      variant: "goat",
      gedempt: true,
    });
    // Een gewone divisie heeft geen premium glans, ook niet met een overlay.
    expect(premiumGlans("onfire", "goud").variant).toBeNull();
  });

  it("zonder tijdelijke overlay speelt de glans wél", () => {
    expect(glansVan(kaart(1450, null))!.className).not.toContain("gedempt");
    expect(glansVan(kaart(1650, null))!.className).not.toContain("gedempt");
  });

  it("de CSS zet de beweging van een gedempte laag echt uit", () => {
    // De klasse alleen is niets waard zonder de regel die hem opvangt.
    expect(blok(".fut-kaart__glans--gedempt::before, .fut-kaart__glans--gedempt::after"))
      .toMatch(/animation:\s*none/);
  });
});

describe("premium glans: rasters starten niet synchroon (#773)", () => {
  it("de vertraging is deterministisch en blijft onder de kortste cyclus", () => {
    // Deterministisch en niet random: een herrender mag de animatie niet laten
    // verspringen. 2400 ms is ruim binnen de kortste cyclus (Big Daddy, 7s).
    expect(glansVertraging("alice")).toBe(glansVertraging("alice"));
    for (const zaad of ["alice", "bob", "carol", "dave", "eve"]) {
      expect(glansVertraging(zaad)).toBeGreaterThanOrEqual(0);
      expect(glansVertraging(zaad)).toBeLessThan(2400);
    }
  });

  it("verschillende spelers krijgen verschillende vertragingen", () => {
    const zaden = ["alice", "bob", "carol", "dave", "eve", "frank", "grace"];
    const uniek = new Set(zaden.map(glansVertraging));
    expect(uniek.size).toBeGreaterThanOrEqual(zaden.length - 1);
  });

  it("zonder zaad is de vertraging 0", () => {
    expect(glansVertraging(undefined)).toBe(0);
    expect(glansVertraging("")).toBe(0);
  });

  it("de vertraging landt als custom property op de laag", () => {
    const laag = glansVan(kaart(1450, null, "alice"))!;
    expect(laag.style.getPropertyValue("--glans-vertraging")).toBe(
      `${glansVertraging("alice")}ms`,
    );
  });
});

describe("premium glans: vier modi op één infrastructuur (#773)", () => {
  const MODUS: ReadonlyArray<readonly [string, string]> = [
    ["Big Daddy", ".fut-kaart.fut-kaart--icon .fut-kaart__glans"],
    ["Kampioen", ".fut-kaart.fut-kaart--kampioen .fut-kaart__glans"],
    ["El Padelissimo", ".fut-kaart--dictator .fut-kaart__glans"],
    ["GOAT", ".fut-kaart--legende .fut-kaart__glans"],
  ];

  it("alle vier hangen aan dezelfde twee keyframes", () => {
    // Eis 13: één gedeelde infrastructuur, geen vier gekopieerde systemen. De
    // varianten mogen alléén in tokens verschillen.
    expect(CSS).toContain("@keyframes fut-glans-baan");
    expect(CSS).toContain("@keyframes fut-glans-hart");
    expect(blok(".fut-kaart__glans::before")).toContain("var(--glans-baan)");
    for (const [, selector] of MODUS) {
      expect(token(selector, "--glans-baan")).not.toBe("");
      expect(token(selector, "--glans-duur")).not.toBe("");
    }
  });

  it.each(MODUS)("%s heeft een eigen duur en intensiteit", (_naam, selector) => {
    const duur = token(selector, "--glans-duur");
    const kracht = token(selector, "--glans-kracht");
    expect(duur).toMatch(/^\d+(\.\d+)?s$/);
    expect(Number.parseFloat(kracht)).toBeGreaterThan(0);
    expect(Number.parseFloat(kracht)).toBeLessThanOrEqual(1);
  });

  it.each(MODUS)("%s houdt zijn lichtste stop onder de leesgrens", (_naam, selector) => {
    // Eis 10: nooit een lichtvlak dat de naamplaat wegvaagt. De grens hoort op de
    // alpha van de hélderste stop te liggen en niet op --glans-kracht: de
    // intensiteit zit in de gradient zelf, want op een licht vlak (Big Daddy,
    // Kampioen) is een zwakke baan onzichtbaar en moest hij juist omhoog. Niet op
    // "rgba(255,255,255,…)" matchen — de GOAT en El Padelissimo hebben geen witte
    // kern maar een roségouden en een antiekgouden.
    const stops = [
      ...token(selector, "--glans-baan").matchAll(
        /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g,
      ),
    ].map((m) => ({
      helderheid: (Number(m[1]) + Number(m[2]) + Number(m[3])) / 765,
      alpha: Number.parseFloat(m[4]),
    }));
    expect(stops.length).toBeGreaterThan(0);
    const kern = stops.reduce((a, b) => (b.helderheid > a.helderheid ? b : a));
    expect(kern.alpha).toBeLessThanOrEqual(0.6);
  });

  it("geen twee varianten delen dezelfde duur", () => {
    // Eis 12: een grid mag niet synchroon knipperen. Het zaad zet de fase, de
    // verschillende duren houden ze daarna uit elkaar.
    const duren = MODUS.map(([, s]) => token(s, "--glans-duur"));
    expect(new Set(duren).size).toBe(MODUS.length);
  });

  it("de trage kaarten zijn de plechtige kaarten", () => {
    // Big Daddy is het feestelijkst en dus het snelst; El Padelissimo het
    // donkerst en het traagst. Dat is de identiteit, niet een willekeurig getal.
    const duur = (s: string) => Number.parseFloat(token(s, "--glans-duur"));
    const [bigDaddy, kampioen, dictator, goat] = MODUS.map(([, s]) => duur(s));
    expect(bigDaddy).toBeLessThan(goat);
    expect(goat).toBeLessThan(kampioen);
    expect(kampioen).toBeLessThan(dictator);
  });

  it("elke variant zet zijn eigen hart-anker", () => {
    // Het tweede effect (puls) komt per kaart uit een ander punt: de krooncrest,
    // het legacy-zegel, het lakzegel, het watermerk. Stonden ze allemaal in het
    // midden, dan waren de vier modi alsnog kopieën van elkaar.
    const harten = MODUS.map(([, s]) => token(s, "--glans-hart"));
    expect(harten.every((h) => h !== "")).toBe(true);
    expect(new Set(harten).size).toBe(MODUS.length);
  });
});

describe("premium glans: beweging, prestatie en toegankelijkheid (#773)", () => {
  it("animeert alleen transform en opacity", () => {
    // Geen continu veranderende box-shadow, filter, blur of backdrop-filter:
    // die hertekenen elk frame en slopen de framerate op mobiel (eis 14).
    const banen = CSS.slice(CSS.indexOf("@keyframes fut-glans-baan"));
    const keyframes = banen.slice(0, banen.indexOf("/* 1. Big Daddy"));
    expect(keyframes).not.toMatch(/box-shadow|filter|blur|backdrop/);
    for (const eigenschap of keyframes.matchAll(/^\s{4}([a-z-]+):/gm)) {
      expect(["transform", "opacity"]).toContain(eigenschap[1]);
    }
  });

  it("de laag verandert de kaartmaat niet en vangt geen clicks", () => {
    // Eis 11: geen layout shift, geen geblokkeerde interacties. `position:
    // absolute` houdt de laag uit de flow, `pointer-events: none` laat de
    // flip-knop eronder werken.
    const basis = blok(".fut-kaart__glans");
    expect(basis).toMatch(/position:\s*absolute/);
    expect(basis).toMatch(/pointer-events:\s*none/);
    expect(basis).toMatch(/z-index:\s*-1/);
  });

  it("beweging staat alleen aan mét bewegingsvoorkeur", () => {
    // Het huis-patroon in dit bestand is opt-in: buiten de media-query staat de
    // statische highlight, erbinnen de animatie. Daardoor is er geen
    // `animation: none` nodig om reduced-motion te respecteren (eis 9) — en kan
    // die ook niet vergeten worden.
    expect(blok(".fut-kaart__glans::before")).not.toMatch(/animation:/);
    expect(blok(".fut-kaart__glans::after")).not.toMatch(/animation:/);
    const query = CSS.slice(CSS.indexOf(".fut-kaart__glans {"));
    const animaties = [...query.matchAll(/animation:\s*fut-glans/g)];
    expect(animaties.length).toBeGreaterThan(0);
    for (const m of animaties) {
      const voor = query.slice(0, m.index);
      expect(voor.lastIndexOf("@media (prefers-reduced-motion: no-preference)"))
        .toBeGreaterThan(voor.lastIndexOf("@keyframes"));
    }
  });

  it("de statische weergave is zichtbaar maar zwakker dan de animatie", () => {
    // Bij reduced motion moet de kaart premium blijven: de highlight staat op
    // 55% van de animatiepiek — aanwezig, niet afwezig.
    expect(blok(".fut-kaart__glans::before")).toMatch(
      /opacity:\s*calc\(var\(--glans-kracht[^)]*\)\s*\*\s*0\.55\)/,
    );
  });

  it("buiten beeld pauzeert de animatie in plaats van te stoppen", () => {
    // `paused` houdt de fase vast, dus een kaart die terugscrollt pikt de baan
    // op waar hij was in plaats van opnieuw te flitsen.
    const buiten = blok(
      ".fut-kaart.is-buiten-beeld .fut-kaart__glans::before, .fut-kaart.is-buiten-beeld .fut-kaart__glans::after",
    );
    expect(buiten).toMatch(/animation-play-state:\s*paused/);
  });

  it("zonder IntersectionObserver animeert de kaart gewoon door", () => {
    // jsdom heeft geen IntersectionObserver, en oudere webviews evenmin. De
    // terugval moet "altijd animeren" zijn, niet "nooit" — anders staat de
    // glans stil op precies de plek waar niemand het test.
    expect("IntersectionObserver" in globalThis).toBe(false);
    expect(kaart(1450, null).className).not.toContain("is-buiten-beeld");
  });
});
