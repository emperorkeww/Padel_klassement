import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TierBadge } from "./TierBadge";

describe("<TierBadge />", () => {
  it("toont het tier-label met de rating-grenzen als tooltip", () => {
    render(<TierBadge rating={1040} />);
    const badge = screen.getByText("Goud II");
    expect(badge).toHaveAttribute("title", "Goud II · rating 1034–1066");
    expect(badge).toHaveClass("tier-badge--goud");
  });

  it("dimt bij een dunne rating", () => {
    render(<TierBadge rating={1012} dimmed />);
    expect(screen.getByText("Goud III")).toHaveClass("is-dim");
  });

  it("kent het kleine formaat", () => {
    render(<TierBadge rating={1250} size="sm" />);
    const badge = screen.getByText("Diamant");
    expect(badge).toHaveClass("tier-badge--sm");
    expect(badge).toHaveClass("tier-badge--diamant");
  });

  it("rendert niets zonder rating", () => {
    const { container } = render(<TierBadge rating={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
