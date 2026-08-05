import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FutKaart } from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";

describe("Piet-mastereffect", () => {
  it("deelt het register maar houdt lijst en voorgrond fysiek apart", () => {
    // #834: achter en binnen dragen de gouden lijst met alles wat eromheen
    // hangt, voor uitsluitend de voorwerpen die die lijst kruisen. Zolang dat
    // twee bestanden zijn, kan geen runtime-masker alsnog lijstpixels over de
    // staf, het cadeau of de kettingen leggen.
    const { container } = render(
      <FutKaart tier={tierFor(1050)} editie="piet" voor={<span>Alice</span>} />,
    );

    const lagen = [...container.querySelectorAll<HTMLElement>(".piet-effect")];
    const bronnen = lagen.map(
      (laag) => laag.querySelector<HTMLImageElement>("img")?.src,
    );

    expect(lagen.map((laag) => laag.dataset.laag)).toEqual([
      "achter",
      "binnen",
      "voor",
    ]);
    expect(bronnen).toHaveLength(3);
    expect(new Set(bronnen).size).toBe(2);
    expect(bronnen[0]).toContain("piet-master");
    expect(bronnen[1]).toBe(bronnen[0]);
    expect(bronnen[2]).toContain("piet-front");
  });

  it("monteert de binneninstantie in het echte kaartvlak", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} editie="piet" voor={<span>Alice</span>} />,
    );

    const binnen = container.querySelector(".piet-effect--binnen");
    expect(binnen?.parentElement).toHaveClass("fut-kaart__vlak");
  });

  it("onderdrukt de oude live Piet-SVG-ornamenten", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} editie="piet" voor={<span>Alice</span>} />,
    );

    expect(
      container.querySelector('use[href="#fut-orn-piet-achter"]'),
    ).toBeNull();
    expect(
      container.querySelector('use[href="#fut-orn-piet-voor"]'),
    ).toBeNull();
  });

  it("rendert geen Piet-effect voor de afzonderlijke pias-editie", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} editie="pias" voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".piet-effect")).toBeNull();
  });
});
