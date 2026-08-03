import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PechMeter } from "./PechMeter";
import { PECHMETER_DOEL } from "@/features/rating/pechvogel";

describe("PechMeter", () => {
  it("toont niets bij een lege meter", () => {
    const { container } = render(
      <PechMeter meter={{ reeks: 0, stand: 0, vol: false }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("toont de tussenstand met het aantal volle vakjes", () => {
    const { container } = render(
      <PechMeter meter={{ reeks: 2, stand: 2, vol: false }} />,
    );
    const meter = screen.getByRole("progressbar");
    expect(meter).toHaveAttribute("aria-valuenow", "2");
    expect(meter).toHaveAttribute("aria-valuemax", String(PECHMETER_DOEL));
    expect(container.querySelectorAll(".pechmeter__vakje--aan")).toHaveLength(2);
    expect(screen.getByText(/2 van de 3/)).toBeInTheDocument();
  });

  it("markeert een volle meter apart", () => {
    const { container } = render(
      <PechMeter meter={{ reeks: 3, stand: 3, vol: true }} />,
    );
    expect(container.querySelector(".pechmeter--vol")).toBeTruthy();
    expect(container.querySelectorAll(".pechmeter__vakje--aan")).toHaveLength(
      PECHMETER_DOEL,
    );
    expect(screen.getByText(/Meter vol/)).toBeInTheDocument();
  });

  it("blijft na de uitbetaling gewoon de nieuwe stand tonen", () => {
    // Vierde nipte nederlaag: de meter is uitgekeerd en telt weer vanaf één.
    render(<PechMeter meter={{ reeks: 4, stand: 1, vol: false }} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  });
});
