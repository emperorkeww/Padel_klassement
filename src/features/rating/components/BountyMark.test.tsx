import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BountyMark } from "@/features/rating/components/BountyMark";

// Het 💰-tekentje naast de naam van een drager (#805). Sinds #1168 staat de
// bounty uit: active_bounties levert geen dragers meer op, dus in de praktijk
// komt hier `null` binnen. De 0-test dekt het vangnet af — een bounty van niks
// aankondigen is een lege belofte.

describe("<BountyMark />", () => {
  it("toont de pool met tekentje en toelichting", () => {
    render(<BountyMark pool={8} />);
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByTitle(/wie hem verslaat, pakt 8 elo/i)).toBeInTheDocument();
  });

  it("rendert niets zonder bounty", () => {
    const { container } = render(<BountyMark pool={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("rendert niets bij een pool van nul (#1168)", () => {
    const { container } = render(<BountyMark pool={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
