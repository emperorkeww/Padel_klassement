import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FutKaart,
  FutKaartVoorkant,
} from "@/features/rating/components/FutKaart";
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

  it("zet de spreuk onder de editieregel, met aanhalingstekens", () => {
    // #834: de spotregel die de referentie onder zijn ondertitel draagt. Hij
    // staat er altijd in de DOM; de container-query in FutKaart.css bepaalt
    // vanaf welke kaartbreedte hij zichtbaar wordt (168px), en jsdom rekent
    // die niet uit. Wat deze test wél kan vastleggen: de volgorde en dat de
    // kaart de aanhalingstekens zet in plaats van de bron.
    const { container } = render(
      <FutKaart
        tier={tierFor(1050)}
        editie="piet"
        voor={
          <FutKaartVoorkant
            elo={1050}
            tier={tierFor(1050)}
            naam="Alice"
            avatar={<span>AA</span>}
            editie="🃏 Piet · 28/6"
            spreuk="Trainen, gij. Dringend."
          />
        }
      />,
    );

    const spreuk = container.querySelector(".fut-kaart__spreuk");
    expect(spreuk).toHaveTextContent("“Trainen, gij. Dringend.”");
    expect(
      spreuk?.previousElementSibling,
      "de spreuk hoort ná de editieregel te staan",
    ).toHaveClass("fut-kaart__editie");
  });

  it("laat de spreuk weg wanneer er geen is", () => {
    const { container } = render(
      <FutKaart
        tier={tierFor(1050)}
        editie="piet"
        voor={
          <FutKaartVoorkant
            elo={1050}
            tier={tierFor(1050)}
            naam="Alice"
            avatar={<span>AA</span>}
            editie="🃏 Piet · 28/6"
            spreuk={null}
          />
        }
      />,
    );

    expect(container.querySelector(".fut-kaart__spreuk")).toBeNull();
  });

  it("rendert geen Piet-effect voor de afzonderlijke pias-editie", () => {
    const { container } = render(
      <FutKaart tier={tierFor(1050)} editie="pias" voor={<span>Alice</span>} />,
    );

    expect(container.querySelector(".piet-effect")).toBeNull();
  });
});
