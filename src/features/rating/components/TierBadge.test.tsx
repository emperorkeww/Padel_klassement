import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TierBadge } from "@/features/rating/components/TierBadge";

describe("<TierBadge />", () => {
  it("toont het tier-label met bijnaam en rating-grenzen als tooltip", () => {
    render(<TierBadge rating={1040} />);
    const badge = screen.getByText("Wannabe II");
    expect(badge).toHaveAttribute(
      "title",
      "Wannabe II · koopt een racket van €350 om het chronische gebrek aan talent te compenseren · rating 1034–1066",
    );
    expect(badge).toHaveClass("tier-badge--goud");
  });

  it("dimt bij een dunne rating", () => {
    render(<TierBadge rating={1012} dimmed />);
    expect(screen.getByText("Wannabe III")).toHaveClass("is-dim");
  });

  it("kent het kleine formaat en de sub-niveaus van Eeuwige belofte", () => {
    render(<TierBadge rating={1250} size="sm" />);
    const diamant = screen.getByText("Eeuwige belofte II");
    expect(diamant).toHaveClass("tier-badge--sm");
    expect(diamant).toHaveClass("tier-badge--diamant");
  });

  it("toont GOAT nu begrensd, mét sub-niveau", () => {
    render(<TierBadge rating={1500} />);
    expect(screen.getByText("GOAT II")).toHaveClass("tier-badge--legende");
  });

  it("toont de hoogste tier (El Padelissimo) zonder sub-niveau", () => {
    render(<TierBadge rating={1650} />);
    expect(screen.getByText("El Padelissimo")).toHaveClass("tier-badge--dictator");
  });

  it("rendert niets zonder rating", () => {
    const { container } = render(<TierBadge rating={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
