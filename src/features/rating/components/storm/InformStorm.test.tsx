import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FutKaart } from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";

describe("In-Form storm-master", () => {
  it("registreert exact één artworkbron in back, inside en front", () => {
    const { container } = render(
      <FutKaart
        tier={tierFor(1050)}
        editie="inform"
        voor={<span>Alice</span>}
      />,
    );

    const lagen = [
      ...container.querySelectorAll<HTMLElement>(".inform-storm"),
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
    expect(bronnen[0]).toContain("storm-master");
  });

  it("houdt het exacte kaartmasker voor de binneninstantie", () => {
    const { container } = render(
      <FutKaart
        tier={tierFor(1050)}
        editie="inform"
        voor={<span>Alice</span>}
      />,
    );

    const binnen = container.querySelector(".inform-storm--binnen");
    expect(binnen?.parentElement).toHaveClass("fut-kaart__vlak");
  });
});
