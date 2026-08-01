import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RouteSkeleton } from "./RouteSkeleton";

// De shell toonde tijdens het lazy-laden voor élke route dezelfde twee grijze
// blokken; daarna plofte de echte layout eroverheen (#949).

function vorm(pathname: string) {
  const { container } = render(<RouteSkeleton pathname={pathname} />);
  return container.querySelector(".route-skeleton")!;
}

describe("<RouteSkeleton /> (#949)", () => {
  it("geeft elke route een eigen vorm", () => {
    // Het overzicht opent met de player card; de feed met een reeks smalle
    // rijen. Zelfde placeholder zou beide beloftes breken.
    const overzicht = vorm("/");
    const feed = vorm("/feed");
    expect(overzicht.innerHTML).not.toBe(feed.innerHTML);
    expect(feed.querySelectorAll(".route-skeleton__card").length).toBe(4);
  });

  it("zet het podium van het klassement als rij neer", () => {
    const kl = vorm("/klassement");
    expect(kl.querySelector(".route-skeleton__rij")?.children).toHaveLength(3);
  });

  it("onderscheidt de matchlijst van één matchdetail", () => {
    expect(
      vorm("/matches").querySelectorAll(".route-skeleton__card").length,
    ).toBeGreaterThan(
      vorm("/matches/m-1").querySelectorAll(".route-skeleton__card").length,
    );
  });

  it("blijft decoratief en tekstloos", () => {
    // Dat de pagina laadt zegt de route zelf zodra hij er is; een skeleton die
    // "Laden…" roept springt bovendien zichtbaar om.
    const el = vorm("/spelen");
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.textContent).toBe("");
  });

  it("valt terug op een neutrale vorm voor een onbekend pad", () => {
    expect(
      vorm("/iets-nieuws").querySelectorAll(".route-skeleton__card").length,
    ).toBe(2);
  });
});
