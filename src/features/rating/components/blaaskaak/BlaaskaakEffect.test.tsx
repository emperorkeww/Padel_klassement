import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  FutKaart,
  FutKaartDefs,
  FutKaartVoorkant,
} from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";

const lees = (pad: string) =>
  readFileSync(fileURLToPath(new URL(pad, import.meta.url)), "utf8");
const BLAASKAAK_CSS = lees("./BlaaskaakEffect.css");

describe("Blaaskaak-mastereffect", () => {
  it("gebruikt één rasterbron voor achter, binnen en voor", () => {
    const { container } = render(
      <FutKaart tier={tierFor(950)} voor={<span>Alice</span>} />,
    );

    const lagen = [
      ...container.querySelectorAll<HTMLElement>(".blaaskaak-effect"),
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
    expect(bronnen[0]).toContain("blaaskaak-master");
  });

  it("monteert de binneninstantie in het echte kaartvlak", () => {
    const { container } = render(
      <FutKaart tier={tierFor(950)} voor={<span>Alice</span>} />,
    );

    const binnen = container.querySelector(".blaaskaak-effect--binnen");
    expect(binnen?.parentElement).toHaveClass("fut-kaart__vlak");
  });

  it("houdt de asymmetrische rechterhoek in de kaartgeometrie zelf", () => {
    const { container } = render(<FutKaartDefs />);
    const ids = [
      "frame",
      "liner",
      "keyline",
      "vlak",
    ] as const;

    for (const laag of ids) {
      const clip = container.querySelector(
        `#fut-schild-blaaskaak-${laag} path`,
      );
      expect(clip).not.toBeNull();
      expect(BLAASKAAK_CSS).toContain(
        `url("#fut-schild-blaaskaak-${laag}")`,
      );
    }

    const frame = container
      .querySelector("#fut-schild-blaaskaak-frame path")
      ?.getAttribute("d");
    expect(frame).toContain(
      "L 0.96 0.19 L 0.96 0.15 L 0.88 0.075 L 0.76 0.04",
    );
    expect(frame).not.toContain("0.5 0.116");

    const keyline = container
      .querySelector("#fut-schild-blaaskaak-keyline path")
      ?.getAttribute("d");
    expect(keyline).toContain(
      "C 0.59 0.09 0.553 0.116 0.5 0.116",
    );
  });

  it("houdt alle lagen decoratief", () => {
    const { container } = render(
      <FutKaart tier={tierFor(950)} voor={<span>Alice</span>} />,
    );

    for (const laag of container.querySelectorAll(".blaaskaak-effect")) {
      expect(laag).toHaveAttribute("aria-hidden", "true");
      const beeld = laag.querySelector("img")!;
      expect(beeld).toHaveAttribute("alt", "");
      expect(beeld).toHaveAttribute("draggable", "false");
    }
  });

  it("verankert de megafoon apart in de kaartuitsparing", () => {
    const { container } = render(
      <FutKaart tier={tierFor(950)} voor={<span>Alice</span>} />,
    );

    expect(container.querySelectorAll(".blaaskaak-effect__megafoon")).toHaveLength(
      1,
    );
    expect(
      container.querySelector(
        ".blaaskaak-effect--voor .blaaskaak-effect__megafoon",
      ),
    ).not.toBeNull();
    expect(BLAASKAAK_CSS).toContain(
      "transform: translateY(calc(var(--fut-kw) * 0.06))",
    );
    expect(BLAASKAAK_CSS).toContain(".blaaskaak-effect--voor::before");
  });

  it("vervangt de oude zilverornamenten en het tactiekwatermerk", () => {
    const { container } = render(
      <FutKaart tier={tierFor(950)} voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".fut-kaart__ornament")).toBeNull();
    expect(container.querySelector(".fut-kaart__motief")).toBeNull();
  });

  it("zet de lawaaisymbolen alleen in de voorste comic-burst", () => {
    const { container } = render(
      <FutKaart tier={tierFor(950)} voor={<span>Alice</span>} />,
    );

    const bursts = container.querySelectorAll(".blaaskaak-effect__burst");
    expect(bursts).toHaveLength(1);
    expect(
      bursts[0].querySelector(".blaaskaak-effect__burst-symbolen"),
    ).toHaveTextContent("#!&*");
    expect(bursts[0].parentElement).toHaveClass(
      "blaaskaak-effect--voor",
    );
    expect(BLAASKAAK_CSS).toContain("place-items: center");
    expect(BLAASKAAK_CSS).toContain(
      "font-size: clamp(7px, calc(var(--fut-kw) * 0.047), 22px)",
    );
  });

  it("groepeert rating, subniveau en spreekhoofd in één ratingkolom", () => {
    const tier = tierFor(950);
    const { container } = render(
      <FutKaart
        tier={tier}
        voor={
          <FutKaartVoorkant
            elo={950}
            tier={tier}
            avatar={<span>PA</span>}
            naam="Alice"
          />
        }
      />,
    );

    const kolom = container.querySelector(".fut-kaart__rating-column");
    expect(kolom).toHaveClass("fut-kaart__eloblok");
    expect(
      [...(kolom?.children ?? [])].map((kind) => kind.className),
    ).toEqual([
      "fut-kaart__elo",
      "fut-kaart__sub",
      "fut-kaart__tier",
    ]);
    expect(kolom?.querySelector(".fut-kaart__elo")).toHaveTextContent("950");
    expect(kolom?.querySelector(".fut-kaart__sub")).toHaveTextContent("II");
    expect(kolom?.querySelector(".fut-kaart__spreekhoofd")).toHaveTextContent(
      "🗣",
    );
  });

  it("laat een editie vóór het Blaaskaak-mastereffect gaan", () => {
    const { container } = render(
      <FutKaart
        tier={tierFor(950)}
        editie="inform"
        voor={<span>Alice</span>}
      />,
    );

    expect(container.querySelector(".blaaskaak-effect")).toBeNull();
    expect(container.querySelector(".inform-storm")).not.toBeNull();
  });

  it("rendert het effect niet op een andere divisie", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".blaaskaak-effect")).toBeNull();
  });
});
