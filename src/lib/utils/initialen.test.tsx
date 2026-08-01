import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "@/ui/Avatar";
import { initialen } from "@/lib/utils/initialen";

// De topbalk toonde "AA" en de profielinstellingen "A" voor dezelfde persoon:
// twee afleidingen naast elkaar (#949). Eén helper, één regel.
describe("initialen (#949)", () => {
  it("neemt de eerste letter van de voor- en achternaam", () => {
    expect(initialen("Alice Anders")).toBe("AA");
    expect(initialen("Carol van den Berg")).toBe("CB");
  });

  it("neemt twee letters bij één naam", () => {
    expect(initialen("alice")).toBe("AL");
  });

  it("geeft op verzoek één letter — voor overlappende avatarparen", () => {
    expect(initialen("Alice Anders", true)).toBe("A");
  });

  it("valt terug op ? zonder naam", () => {
    expect(initialen("   ")).toBe("?");
  });

  it("gebruikt dezelfde afleiding in het component", () => {
    render(<Avatar name="Alice Anders" />);
    expect(screen.getByText("AA")).toBeInTheDocument();
  });
});
