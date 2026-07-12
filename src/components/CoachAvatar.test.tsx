import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachAvatar } from "./CoachAvatar";

describe("<CoachAvatar />", () => {
  it("rendert een toegankelijke coach-illustratie", () => {
    render(<CoachAvatar />);
    const img = screen.getByRole("img", { name: "Coach Rudy" });
    expect(img.tagName.toLowerCase()).toBe("img");
    // Gebruikt een echte afbeelding uit rudi_avatars/.
    expect(img).toHaveAttribute("src");
  });

  it("schaalt mee met de size-prop", () => {
    render(<CoachAvatar size={48} />);
    const img = screen.getByRole("img", { name: "Coach Rudy" });
    expect(img).toHaveAttribute("width", "48");
    expect(img).toHaveAttribute("height", "48");
  });
});
