import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FutKaart } from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";

describe("Pias-mastereffect", () => {
  it("gebruikt één bron voor achter, binnen en voor", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} editie="pias" voor={<span>Alice</span>} />,
    );

    const lagen = [...container.querySelectorAll<HTMLElement>(".pias-effect")];
    const bronnen = lagen.map(
      (laag) => laag.querySelector<HTMLImageElement>("img")?.src,
    );

    expect(lagen.map((laag) => laag.dataset.laag)).toEqual([
      "achter",
      "binnen",
      "voor",
    ]);
    expect(bronnen).toHaveLength(3);
    expect(new Set(bronnen).size).toBe(1);
    expect(bronnen[0]).toContain("pias-master");
  });

  it("monteert de binneninstantie in het echte kaartvlak", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} editie="pias" voor={<span>Alice</span>} />,
    );

    const binnen = container.querySelector(".pias-effect--binnen");
    expect(binnen?.parentElement).toHaveClass("fut-kaart__vlak");
  });

  it("houdt de lagen decoratief en niet-interactief", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} editie="pias" voor={<span>Alice</span>} />,
    );

    for (const laag of container.querySelectorAll(".pias-effect")) {
      expect(laag).toHaveAttribute("aria-hidden", "true");
      expect(laag.querySelector("img")).toHaveAttribute("alt", "");
    }
  });

  it("onderdrukt de oude live pias-SVG-ornamenten", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} editie="pias" voor={<span>Alice</span>} />,
    );

    expect(
      container.querySelector('use[href="#fut-orn-pias-achter"]'),
    ).toBeNull();
    expect(container.querySelector('use[href="#fut-orn-pias-voor"]')).toBeNull();
  });

  it("rendert geen pias-effect voor de Zwarte Piet-editie", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} editie="piet" voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".pias-effect")).toBeNull();
  });
});

// Het frontmasker is sinds de schildcontour-correctie geen los handwerk meer: de
// vensters van de onderste groepen dragen dezelfde horizontale schuif als het
// artwork. Loopt dat uit elkaar, dan valt een verschoven prop half achter het
// frame en wordt hij op de framerand afgesneden — precies de fout die een
// breakout kapotmaakt. Deze controles zijn de tripwire daarvoor.
describe("Pias-frontmasker", () => {
  // Het pad via een variabele opbouwen: de letterlijke vorm
  // `new URL("…", import.meta.url)` herkent Vite als asset-referentie en
  // herschrijft hij naar een http-URL, waar fileURLToPath op stukloopt (zelfde
  // truc als in assetBudget.test.ts).
  const pad = (p: string) => fileURLToPath(new URL(p, import.meta.url));
  const masker = readFileSync(pad("./assets/pias-front-mask.svg"), "utf8");

  /** Elk venster op naam: het script zet de groepsnaam als commentaar achter
   *  zijn ellips, dus één regel per groep. */
  const vensters = new Map<string, { cx: number; cy: number }>(
    masker
      .split("\n")
      .map((regel) =>
        /<ellipse cx="([\d.]+)" cy="([\d.]+)".*<!-- ([a-z-]+) -->/.exec(regel),
      )
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[3], { cx: Number(m[1]), cy: Number(m[2]) }]),
  );

  it("is gegenereerd en dekt elke objectgroep uit het script", () => {
    expect(masker).toContain("GEGENEREERD door scripts/pias-master.py");
    expect([...vensters.keys()]).toEqual([
      "kroon",
      "klaver",
      "pion",
      "kaarten",
      "nar",
      "bagel",
      "rozet",
      "lint-links",
      "lint-rechts",
    ]);
  });

  it("houdt het rozetvenster op de onderas van de kaart", () => {
    // Het kaartvak ligt in het master-canvas op x 116…908, dus de as is 512.
    expect(Math.abs(vensters.get("rozet")!.cx - 512)).toBeLessThanOrEqual(2);
  });

  it("schuift de lintvensters mee naar binnen", () => {
    // Ongeschoven staan ze op 262 en 782; het schild knijpt op die hoogte al ~100
    // px naar binnen, dus beide vensters horen richting de as te zijn opgeschoven.
    expect(vensters.get("lint-links")!.cx).toBeGreaterThan(300);
    expect(vensters.get("lint-rechts")!.cx).toBeLessThan(730);
  });

  it("laat de bovenste groepen ongemoeid", () => {
    // Boven de taps lopen schildrand en referentierand samen: daar is niets te
    // verschuiven, en een schuif daar zou de kroon van de bovenrand losmaken.
    expect(vensters.get("kroon")).toEqual({ cx: 514, cy: 150 });
    expect(vensters.get("klaver")).toEqual({ cx: 890, cy: 200 });
  });
});
