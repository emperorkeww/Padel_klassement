import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FutKaart } from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";

describe("On Fire-mastereffect", () => {
  it("gebruikt één bron met hetzelfde register voor achter, binnen en voor", () => {
    const { container } = render(
      <FutKaart
        tier={tierFor(1050)}
        editie="onfire"
        voor={<span>Alice</span>}
      />,
    );

    const lagen = [
      ...container.querySelectorAll<HTMLElement>(".onfire-effect"),
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
    expect(bronnen[0]).toContain("onfire-master");
  });

  it("monteert de binneninstantie in het werkelijke kaartvlak", () => {
    const { container } = render(
      <FutKaart
        tier={tierFor(1050)}
        editie="onfire"
        voor={<span>Alice</span>}
      />,
    );

    const binnen = container.querySelector(".onfire-effect--binnen");
    expect(binnen?.parentElement).toHaveClass("fut-kaart__vlak");
  });
});
