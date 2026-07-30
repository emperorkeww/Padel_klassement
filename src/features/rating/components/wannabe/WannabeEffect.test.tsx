import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FutKaart } from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";

describe("Wannabe-mastereffect", () => {
  it("gebruikt één bron voor achter, binnen en voor", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} voor={<span>Alice</span>} />,
    );

    const lagen = [
      ...container.querySelectorAll<HTMLElement>(".wannabe-effect"),
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
    expect(bronnen[0]).toContain("wannabe-master");
  });

  it("monteert de binneninstantie in het echte kaartvlak", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} voor={<span>Alice</span>} />,
    );

    const binnen = container.querySelector(".wannabe-effect--binnen");
    expect(binnen?.parentElement).toHaveClass("fut-kaart__vlak");
  });

  it("houdt de lagen decoratief: geen alt-tekst, geen drag", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} voor={<span>Alice</span>} />,
    );

    for (const laag of container.querySelectorAll(".wannabe-effect")) {
      expect(laag).toHaveAttribute("aria-hidden", "true");
      const beeld = laag.querySelector("img")!;
      expect(beeld).toHaveAttribute("alt", "");
      expect(beeld).toHaveAttribute("draggable", "false");
    }
  });

  it("vervangt de folieranden, crest en medaillon van de goud-divisie", () => {
    // Het artwork draagt die vormen nu zelf; de vector-SVG's blijven bestaan
    // voor de canvas-/posterroute maar mogen in de DOM niet dubbel staan.
    const { container } = render(
      <FutKaart tier={tierFor(1050)} voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".fut-kaart__ornament")).toBeNull();
    expect(container.querySelector(".fut-kaart__motief")).toBeNull();
  });

  it("laat een editie vóór het mastereffect gaan", () => {
    // Een Wannabe met In-Form houdt zijn editielaag: dan geen wannabe-master,
    // maar wel de storm — dezelfde cascade als bij de andere divisies.
    const { container } = render(
      <FutKaart
        tier={tierFor(1050)}
        editie="inform"
        voor={<span>Alice</span>}
      />,
    );

    expect(container.querySelector(".wannabe-effect")).toBeNull();
    expect(container.querySelector(".inform-storm")).not.toBeNull();
  });

  it("rendert geen wannabe-effect op andere divisies", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1250)} voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".wannabe-effect")).toBeNull();
  });
});
