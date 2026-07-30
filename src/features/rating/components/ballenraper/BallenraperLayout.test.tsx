import { render, screen } from "@testing-library/react";
import { tierFor } from "@/features/rating/tiers";
import { FutKaart, FutKaartVoorkant } from "../FutKaart";

describe("Ballenraper-layout", () => {
  it("houdt alle spelerinhoud dynamisch en gebruikt de eigen artworkslots", () => {
    const tier = tierFor(750);
    const { container } = render(
      <FutKaart
        tier={tier}
        voor={
          <FutKaartVoorkant
            elo={750}
            tier={tier}
            naam="Dynamische Speler"
            avatar={<span>DS</span>}
            statBron={{
              gespeeld: 20,
              gewonnen: 8,
              gelijk: 2,
              verloren: 10,
              punten: 26,
              doelsaldo: -4,
            }}
          />
        }
      />,
    );

    expect(container.querySelector(".fut-kaart--ballenraper-layout")).toBeTruthy();
    expect(
      container.querySelector(
        ".fut-kaart__flipper > .kaart-onderdelen--binnen",
      ),
    ).toBeTruthy();
    expect(
      container.querySelector(".fut-kaart__vlak .kaart-onderdelen"),
    ).toBeNull();
    expect(container.querySelector(".kaart-onderdelen--voor")).toBeNull();
    expect(screen.getByText("750")).toBeTruthy();
    expect(screen.getByText("Dynamische Speler")).toBeTruthy();
    expect(screen.getByText("RAPEN")).toBeTruthy();
  });

  it("wijkt voor een tijdelijke editie terug naar de bestaande kaart", () => {
    const tier = tierFor(750);
    const { container } = render(
      <FutKaart
        tier={tier}
        editie="inform"
        voor={
          <FutKaartVoorkant
            elo={750}
            tier={tier}
            naam="Alice"
            avatar={<span>AA</span>}
          />
        }
      />,
    );

    expect(
      container.querySelector(".fut-kaart--ballenraper-layout"),
    ).toBeNull();
    expect(container.querySelector(".fut-kaart__eloblok")).toBeTruthy();
  });
});
