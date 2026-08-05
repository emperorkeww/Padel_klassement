import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FutKaart,
  FutKaartVoorkant,
} from "@/features/rating/components/FutKaart";
import { tierFor } from "@/features/rating/tiers";

const GLAZENWASSER = tierFor(1150);

describe("Glazenwasser-mastereffect", () => {
  it("deelt het register maar houdt frame en voorgrond fysiek apart", () => {
    const { container } = render(
      <FutKaart tier={GLAZENWASSER} voor={<span>Alice</span>} />,
    );

    const lagen = [
      ...container.querySelectorAll<HTMLElement>(".glazenwasser-effect"),
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
    expect(new Set(bronnen).size).toBe(2);
    expect(bronnen[0]).toContain("glazenwasser-master");
    expect(bronnen[1]).toBe(bronnen[0]);
    expect(bronnen[2]).toContain("glazenwasser-front");
  });

  it("monteert de binneninstantie in het echte kaartvlak", () => {
    const { container } = render(
      <FutKaart tier={GLAZENWASSER} voor={<span>Alice</span>} />,
    );

    const binnen = container.querySelector(".glazenwasser-effect--binnen");
    expect(binnen?.parentElement).toHaveClass("fut-kaart__vlak");
  });

  it("monteert de voorlaag buiten de 3D-flipper en vóór het frame", () => {
    const { container } = render(
      <FutKaart tier={GLAZENWASSER} voor={<span>Alice</span>} />,
    );

    const kaart = container.querySelector<HTMLElement>(".fut-kaart");
    const flipper = container.querySelector<HTMLElement>(
      ".fut-kaart__flipper",
    );
    const voor = container.querySelector<HTMLElement>(
      ".glazenwasser-effect--voor",
    );

    expect(voor?.parentElement).toBe(kaart);
    expect(flipper).not.toContainElement(voor);
  });

  it("houdt de lagen decoratief en niet-interactief", () => {
    const { container } = render(
      <FutKaart tier={GLAZENWASSER} voor={<span>Alice</span>} />,
    );

    for (const laag of container.querySelectorAll(".glazenwasser-effect")) {
      expect(laag).toHaveAttribute("aria-hidden", "true");
      expect(laag.querySelector("img")).toHaveAttribute("alt", "");
    }
  });

  it("onderdrukt de platina-vectorornamenten en het wandmotief", () => {
    // Crest, paneelklemmen, veegbogen, glasmedaillon en het paneelraster zitten
    // sinds #834 in de master. Bleven de vectoren staan, dan stond er een tweede
    // crest náást de raamcrest en twee watermerken over elkaar.
    const { container } = render(
      <FutKaart tier={GLAZENWASSER} voor={<span>Alice</span>} />,
    );

    expect(
      container.querySelector('use[href="#fut-div-platina-achter"]'),
    ).toBeNull();
    expect(
      container.querySelector('use[href="#fut-div-platina-voor"]'),
    ).toBeNull();
    expect(container.querySelector(".fut-kaart__motief")).toBeNull();
  });

  it("gebruikt de vaste divisienaam zonder het niveau dubbel te zetten", () => {
    const { getByText, queryByText } = render(
      <FutKaart
        tier={GLAZENWASSER}
        voor={
          <FutKaartVoorkant
            elo={1150}
            tier={GLAZENWASSER}
            naam="Alice"
            avatar={<span>AA</span>}
          />
        }
      />,
    );

    expect(getByText("GLAZENWASSER")).toBeInTheDocument();
    expect(queryByText("Glazenwasser II")).toBeNull();
  });

  it("wijkt voor een editie: die skin wint van de divisie", () => {
    const { container } = render(
      <FutKaart tier={GLAZENWASSER} editie="inform" voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".glazenwasser-effect")).toBeNull();
  });

  it("rendert niet voor een andere divisie", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".glazenwasser-effect")).toBeNull();
  });
});
