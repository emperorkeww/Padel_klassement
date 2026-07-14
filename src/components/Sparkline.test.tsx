import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RATING_HISTORY } from "../test/fixtures";
import { Sparkline } from "./Sparkline";
import { downsample, toPolylinePoints } from "@/lib/utils/sparkline";

describe("downsample", () => {
  it("geeft een korte reeks ongewijzigd terug", () => {
    expect(downsample([], 20)).toEqual([]);
    expect(downsample([1, 2, 3], 20)).toEqual([1, 2, 3]);
  });

  it("dunt uit tot max punten, met eerste en laatste behouden", () => {
    const input = Array.from({ length: 100 }, (_, i) => i);
    const out = downsample(input, 20);
    expect(out).toHaveLength(20);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(99);
    // Geen dubbele punten: elke index komt hoogstens één keer voor.
    expect(new Set(out).size).toBe(20);
  });
});

describe("toPolylinePoints", () => {
  const parse = (points: string) =>
    points.split(" ").map((p) => p.split(",").map(Number) as [number, number]);

  it("geeft een lege string bij minder dan twee waarden", () => {
    expect(toPolylinePoints([])).toBe("");
    expect(toPolylinePoints([1000])).toBe("");
  });

  it("tekent een vlakke reeks als horizontale middellijn", () => {
    const pts = parse(toPolylinePoints([1000, 1000, 1000], 72, 24, 2));
    expect(pts).toHaveLength(3);
    for (const [, y] of pts) expect(y).toBe(12);
    // x loopt van de linker- naar de rechtermarge.
    expect(pts[0][0]).toBe(2);
    expect(pts[2][0]).toBe(70);
  });

  it("schaalt een stijgende reeks van onder naar boven", () => {
    const pts = parse(toPolylinePoints([1000, 1010, 1020], 72, 24, 2));
    // In SVG is een kleinere y hoger: de y-waarden dalen dus.
    expect(pts[0][1]).toBe(22);
    expect(pts[1][1]).toBe(12);
    expect(pts[2][1]).toBe(2);
  });
});

describe("<Sparkline />", () => {
  it("rendert een polyline met toegankelijk label", () => {
    render(<Sparkline history={RATING_HISTORY} name="Alice Anders" />);
    const svg = screen.getByRole("img", {
      name: "Ratingverloop van Alice Anders",
    });
    // Startrating + rating na elke match = 3 punten.
    const points = svg.querySelector("polyline")?.getAttribute("points");
    expect(points?.split(" ")).toHaveLength(3);
  });

  it("rendert niets zonder historie", () => {
    const { container } = render(<Sparkline history={[]} name="Bob Boers" />);
    expect(container).toBeEmptyDOMElement();
  });
});
