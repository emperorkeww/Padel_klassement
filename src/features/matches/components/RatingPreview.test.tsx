import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RatingPreview } from "./RatingPreview";

// K_FACTOR = 24. Bij een winkans van 0,5 is de mutatie ±12; bij 0,25 is winst
// +18 en verlies −6. De cijfers hieronder zijn met de hand nagerekend tegen
// `round(k * (sa - ea) * f)` uit _apply_match_rating.

describe("<RatingPreview />", () => {
  it("toont de gewone mutatie zonder modifier", () => {
    render(<RatingPreview mijnKans={0.5} />);
    expect(screen.getByText("+12")).toBeInTheDocument();
    expect(screen.getByText("-12")).toBeInTheDocument();
  });

  it("rekent asymmetrisch bij een scheve winkans", () => {
    // Underdog: veel te winnen, weinig te verliezen.
    render(<RatingPreview mijnKans={0.25} />);
    expect(screen.getByText("+18")).toBeInTheDocument();
    expect(screen.getByText("-6")).toBeInTheDocument();
  });

  it("verdubbelt bij een lef-tip en zegt dat ook", () => {
    render(<RatingPreview mijnKans={0.5} staked />);
    expect(screen.getByText("+24")).toBeInTheDocument();
    expect(screen.getByText("-24")).toBeInTheDocument();
    expect(screen.getByText(/lef/i)).toBeInTheDocument();
  });

  it("verdubbelt bij dubbel of niets", () => {
    render(<RatingPreview mijnKans={0.5} joker="dubbel_of_niets" />);
    expect(screen.getByText("+24")).toBeInTheDocument();
    expect(screen.getByText(/dubbel of niets/i)).toBeInTheDocument();
  });

  it("verdubbelt niet twee keer als lef én dubbel of niets samenvallen", () => {
    // _effect_factor neemt greatest(), geen product — anders zou hier ×4 staan.
    render(<RatingPreview mijnKans={0.5} staked joker="dubbel_of_niets" />);
    expect(screen.getByText("+24")).toBeInTheDocument();
    expect(screen.queryByText("+48")).toBeNull();
  });

  it("zet alles op nul bij een schild, ook mét lef", () => {
    // Het schild wint van alles: factor 0, onvoorwaardelijk.
    render(<RatingPreview mijnKans={0.25} staked joker="schild" />);
    expect(screen.getByText(/telt niet mee/i)).toBeInTheDocument();
    expect(screen.queryByText("+18")).toBeNull();
    expect(screen.queryByText("+36")).toBeNull();
  });

  it("laat wissel van kant de rating ongemoeid", () => {
    render(<RatingPreview mijnKans={0.5} joker="wissel_van_kant" />);
    expect(screen.getByText("+12")).toBeInTheDocument();
    expect(screen.getByText(/wissel van kant/i)).toBeInTheDocument();
  });

  it("toont niets zonder bekende winkans", () => {
    // Bv. een organisator die zelf niet meespeelt: die heeft hier geen rating
    // in het spel, en een verzonnen cijfer is erger dan geen cijfer.
    const { container } = render(<RatingPreview mijnKans={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
