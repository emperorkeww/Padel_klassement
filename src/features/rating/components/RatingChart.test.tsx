import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RATING_HISTORY } from "@/test/fixtures";
import { RatingChart } from "@/features/rating/components/RatingChart";

// jsdom past de stylesheet niet toe: dat de lijn ook zonder (afgeronde)
// animatie zichtbaar is, zit in de CSS-structuur van RatingChart.css — de
// verborgen staat leeft alleen in de keyframes (#139). Hier bewaken we de
// SVG-structuur waar die CSS op mikt.
describe("<RatingChart />", () => {
  it("tekent een doorlopende lijn bovenop het gevulde vlak", () => {
    render(<RatingChart history={RATING_HISTORY} />);
    const svg = screen.getByRole("img", {
      name: "Rating-verloop: gestegen van 1000 naar 1012",
    });

    const line = svg.querySelector("path.rating-chart__line");
    expect(line).not.toBeNull();
    // pathLength=1 normaliseert de padlengte voor de dash-animatie.
    expect(line).toHaveAttribute("pathLength", "1");
    // Startrating + rating na elke match = 3 punten: M plus twee L-segmenten.
    expect(line?.getAttribute("d")).toMatch(/^M /);
    expect(line?.getAttribute("d")?.match(/L /g)).toHaveLength(2);

    // Het vlak is het gesloten pad (…Z) en staat vóór de lijn in de DOM,
    // zodat de lijn erbovenop ligt.
    const area = svg.querySelector("path.rating-chart__area");
    expect(area?.getAttribute("d")).toMatch(/Z$/);
    expect(
      area!.compareDocumentPosition(line!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("toont een uitleg in plaats van een grafiek bij te weinig historie", () => {
    render(<RatingChart history={[RATING_HISTORY[0]]} />);
    expect(screen.getByText(/te weinig matches/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  // De lijnkleur codeert of je rating steeg of daalde. Kleur alleen is geen
  // signaal (WCAG 1.4.1), dus het toegankelijke label zegt het er sinds #1074
  // ook in woorden bij — en dat moet met de reeks meebewegen.
  it("noemt de richting van de reeks in het toegankelijke label", () => {
    const gedaald = RATING_HISTORY.map((h) => ({
      ...h,
      rating_before: 2000 - (h.rating_before - 1000),
      rating_after: 2000 - (h.rating_after - 1000),
      delta: -h.delta,
    }));
    render(<RatingChart history={gedaald} />);
    expect(
      screen.getByRole("img", { name: /^Rating-verloop: gedaald van/ }),
    ).toBeInTheDocument();
  });
});
