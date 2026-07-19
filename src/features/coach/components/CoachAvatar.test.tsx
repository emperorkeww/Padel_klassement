import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";

describe("<CoachAvatar />", () => {
  it("rendert een toegankelijke coach-illustratie", () => {
    render(<CoachAvatar />);
    const img = screen.getByRole("img", { name: "Coach Rudy" });
    expect(img.tagName.toLowerCase()).toBe("img");
    expect(img).toHaveAttribute("src");
  });

  it("schaalt mee met de size-prop", () => {
    render(<CoachAvatar size={48} />);
    const img = screen.getByRole("img", { name: "Coach Rudy" });
    expect(img).toHaveAttribute("width", "48");
    expect(img).toHaveAttribute("height", "48");
  });

  it("valt terug op de portret-illustratie voor een stemming zonder eigen tekening (buiging, #531)", () => {
    // rudi-buiging.png bestaat nog niet: de glob-conventie degradeert dan netjes
    // naar de portret-basis i.p.v. een lege avatar.
    const { unmount } = render(<CoachAvatar mood="portret" fixed />);
    const portret = screen
      .getByRole("img", { name: "Coach Rudy" })
      .getAttribute("src");
    unmount();
    render(<CoachAvatar mood="buiging" fixed />);
    const buiging = screen
      .getByRole("img", { name: "Coach Rudy" })
      .getAttribute("src");
    expect(buiging).toBe(portret);
  });

  it("toont met fixed altijd dezelfde illustratie", () => {
    const { unmount } = render(<CoachAvatar mood="portret" fixed />);
    const first = screen.getByRole("img", { name: "Coach Rudy" }).getAttribute("src");
    unmount();
    render(<CoachAvatar mood="portret" fixed />);
    const second = screen.getByRole("img", { name: "Coach Rudy" }).getAttribute("src");
    expect(second).toBe(first);
  });
});
