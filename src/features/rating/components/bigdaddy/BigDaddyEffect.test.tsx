import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FutKaart } from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";

const lees = (pad: string) => readFileSync(resolve(process.cwd(), pad), "utf8");

/** Canvasmaat uit de VP8X-chunk van een uitgebreide WebP (breedte-1/hoogte-1 als
 *  24-bit little-endian). Genoeg om te bewaken dat master en maskers op één
 *  raster staan, zonder een beeldbibliotheek in de test te trekken. */
function webpMaat(pad: string): { breedte: number; hoogte: number } {
  const buf = readFileSync(resolve(process.cwd(), pad));
  expect(buf.toString("ascii", 0, 4), `${pad} is geen RIFF-bestand`).toBe("RIFF");
  expect(buf.toString("ascii", 12, 16), `${pad} mist de VP8X-chunk`).toBe("VP8X");
  return {
    breedte: buf.readUIntLE(24, 3) + 1,
    hoogte: buf.readUIntLE(27, 3) + 1,
  };
}

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

    // Master en maskers moeten op hetzelfde raster staan. De maskers gaan
    // verkleind de repo in (zacht van aard, en de CSS rekt ze naar 100% × 100%),
    // dus met precies de deler uit het script.
    const deler = getal(script, /const MASKER_DELER = (\d+);/);
    const map = "src/features/rating/components/bigdaddy/assets";
    const master = webpMaat(`${map}/bigdaddy-master.webp`);
    expect(master.breedte).toBe(Math.round(kaartB * canvasBreed));
    expect(master.hoogte).toBe(Math.round(kaartH * canvasHoog));

    for (const naam of ["front", "inside"]) {
      const masker = webpMaat(`${map}/bigdaddy-${naam}-mask.webp`);
      expect(masker.breedte, `${naam}-mask staat op een ander raster`).toBe(
        Math.round(master.breedte / deler),
      );
      expect(
        Math.abs(
          masker.hoogte / masker.breedte - master.hoogte / master.breedte,
        ),
        `${naam}-mask heeft een andere beeldverhouding dan de master`,
      ).toBeLessThan(0.01);
    }
  });

  it("rendert geen Big Daddy-effect zonder icon-editie", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".bigdaddy-effect")).toBeNull();
  });
});
