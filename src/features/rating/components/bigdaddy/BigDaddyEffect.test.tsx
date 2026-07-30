import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FutKaart } from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";

const lees = (pad: string) => readFileSync(resolve(process.cwd(), pad), "utf8");

describe("Big Daddy-mastereffect", () => {
  it("gebruikt één bron voor achter, binnen en voor", () => {
    const { container } = render(
      <FutKaart
        tier={tierFor(1050)}
        editie="icon"
        voor={<span>Alice</span>}
      />,
    );

    const lagen = [
      ...container.querySelectorAll<HTMLElement>(".bigdaddy-effect"),
    ];
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
    expect(bronnen[0]).toContain("bigdaddy-master");
  });

  it("monteert de binneninstantie in het echte kaartvlak", () => {
    const { container } = render(
      <FutKaart
        tier={tierFor(1050)}
        editie="icon"
        voor={<span>Alice</span>}
      />,
    );

    const binnen = container.querySelector(".bigdaddy-effect--binnen");
    expect(binnen?.parentElement).toHaveClass("fut-kaart__vlak");
  });

  it("onderdrukt de oude live SVG-ornamenten voor de icon-editie", () => {
    const { container } = render(
      <FutKaart
        tier={tierFor(1050)}
        editie="icon"
        voor={<span>Alice</span>}
      />,
    );

    expect(
      container.querySelector('use[href="#fut-orn-bigdaddy-achter"]'),
    ).toBeNull();
    expect(
      container.querySelector('use[href="#fut-orn-bigdaddy-voor"]'),
    ).toBeNull();
  });

  it("houdt master, maskers en CSS-registratie op één canvas (#834)", () => {
    // De master en de twee maskers komen uit
    // scripts/bigdaddy-master-compose.mjs. Loopt de marge in dat script uit de
    // pas met de --bigdaddy-master-*-waarden in de CSS, dan schuift élk object
    // t.o.v. het frame — en dat is op een screenshot pas laat te zien. Deze
    // test vergelijkt daarom de drie bronnen als tekst.
    const script = lees("scripts/bigdaddy-master-compose.mjs");
    const css = lees("src/features/rating/components/bigdaddy/BigDaddyEffect.css");

    const getal = (bron: string, patroon: RegExp) => {
      const m = patroon.exec(bron);
      expect(m, `${patroon} niet gevonden`).not.toBeNull();
      return Number(m![1]);
    };

    const margeL = getal(script, /const MARGE_L = ([\d.]+);/);
    const margeT = getal(script, /const MARGE_T = ([\d.]+);/);
    const canvasBreed = getal(script, /KAART_B \* ([\d.]+)\); \/\/ 1280/);
    const canvasHoog = getal(script, /KAART_H \* ([\d.]+)\); \/\/ 1727/);
    const kaartB = getal(script, /const KAART_B = (\d+);/);
    const kaartH = Math.round((kaartB * 139) / 100);

    expect(getal(css, /--bigdaddy-master-left: -([\d.]+)%;/) / 100).toBe(margeL);
    expect(getal(css, /--bigdaddy-master-top: -([\d.]+)%;/) / 100).toBe(margeT);
    expect(getal(css, /--bigdaddy-master-width: ([\d.]+)%;/) / 100).toBe(
      canvasBreed,
    );

    // Beide maskers moeten op de viewBox van datzelfde canvas staan.
    const viewBox = `viewBox="0 0 ${Math.round(kaartB * canvasBreed)} ${Math.round(
      kaartH * canvasHoog,
    )}"`;
    for (const naam of ["front", "inside"]) {
      expect(
        lees(
          `src/features/rating/components/bigdaddy/assets/bigdaddy-${naam}-mask.svg`,
        ),
        `${naam}-mask staat op een andere viewBox`,
      ).toContain(viewBox);
    }
  });

  it("rendert geen Big Daddy-effect zonder icon-editie", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".bigdaddy-effect")).toBeNull();
  });
});
