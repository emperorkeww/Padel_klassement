import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TierBadge } from "./TierBadge";

describe("<TierBadge />", () => {
  it("toont het tier-label met bijnaam en rating-grenzen als tooltip", () => {
    render(<TierBadge rating={1040} />);
    const badge = screen.getByText("Goud II");
    expect(badge).toHaveAttribute(
      "title",
      "Goud II · goudhaantje · rating 1034–1066",
    );
    expect(badge).toHaveClass("tier-badge--goud");
  });

  it("dimt bij een dunne rating", () => {
    render(<TierBadge rating={1012} dimmed />);
    expect(screen.getByText("Goud III")).toHaveClass("is-dim");
  });

  it("kent het kleine formaat en de sub-niveaus van Diamant", () => {
    render(<TierBadge rating={1250} size="sm" />);
    const diamant = screen.getByText("Diamant II");
    expect(diamant).toHaveClass("tier-badge--sm");
    expect(diamant).toHaveClass("tier-badge--diamant");
  });

  it("toont de hoogste tier zonder sub-niveau", () => {
    render(<TierBadge rating={1500} />);
    expect(screen.getByText("Legende")).toHaveClass("tier-badge--legende");
  });

  it("rendert niets zonder rating", () => {
    const { container } = render(<TierBadge rating={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
