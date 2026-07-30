import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FutKaart } from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";

describe("Dictator-mastereffect", () => {
  it("gebruikt één bron voor achter, binnen en voor", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1650)} voor={<span>Alice</span>} />,
    );

    const lagen = [
      ...container.querySelectorAll<HTMLElement>(".dictator-effect"),
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
    expect(bronnen[0]).toContain("dictator-master");
  });

  it("monteert de binneninstantie in het echte kaartvlak", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1650)} voor={<span>Alice</span>} />,
    );

    const binnen = container.querySelector(".dictator-effect--binnen");
    expect(binnen?.parentElement).toHaveClass("fut-kaart__vlak");
  });

  it("rendert geen dictatoreffect op andere tiers", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1450)} voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".dictator-effect")).toBeNull();
  });
});
