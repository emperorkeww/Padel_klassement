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
