import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FutKaart } from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";

describe("GOAT-mastereffect", () => {
  it("gebruikt één bron voor achter, binnen en voor", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1450)} voor={<span>Alice</span>} />,
    );

    const lagen = [...container.querySelectorAll<HTMLElement>(".goat-effect")];
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
    expect(bronnen[0]).toContain("goat-master");
  });

  it("monteert de binneninstantie in het echte kaartvlak", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1450)} voor={<span>Alice</span>} />,
    );

    const binnen = container.querySelector(".goat-effect--binnen");
    expect(binnen?.parentElement).toHaveClass("fut-kaart__vlak");
  });

  it("houdt de lagen decoratief: geen alt-tekst, geen drag", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1450)} voor={<span>Alice</span>} />,
    );

    for (const laag of container.querySelectorAll(".goat-effect")) {
      expect(laag).toHaveAttribute("aria-hidden", "true");
      const beeld = laag.querySelector("img")!;
      expect(beeld).toHaveAttribute("alt", "");
      expect(beeld).toHaveAttribute("draggable", "false");
    }
  });

  it("vervangt de losse hoorn-SVG's op de kale GOAT-kaart", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1450)} voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".fut-kaart__ornament")).toBeNull();
  });

  it("laat een editie-ornament vóór het mastereffect gaan", () => {
    // Een GOAT met In-Form houdt zijn editielaag: dan geen goat-master, maar
    // wel het vectorornament — dezelfde cascade als bij de andere tiers.
    const { container } = render(
      <FutKaart tier={tierFor(1450)} editie="inform" voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".goat-effect")).toBeNull();
    expect(container.querySelector(".fut-kaart__ornament")).not.toBeNull();
  });

  it("rendert geen goateffect op andere tiers", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1650)} voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".goat-effect")).toBeNull();
  });
});
