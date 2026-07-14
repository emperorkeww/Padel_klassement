import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CoachIntro } from "@/features/feed/components/CoachIntro";

function renderIntro(onDismiss = vi.fn()) {
  render(
    <MemoryRouter>
      <CoachIntro onDismiss={onDismiss} />
    </MemoryRouter>,
  );
  return onDismiss;
}

describe("<CoachIntro />", () => {
  it("stelt Coach Rudy voor met een link naar de afstelling", () => {
    renderIntro();
    expect(
      screen.getByRole("heading", { name: /maak kennis met coach rudy/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /coach afstellen/i }),
    ).toHaveAttribute("href", "/profiel");
  });

  it("dismisst via de sluitknop én via 'Begrepen'", () => {
    const onDismiss = renderIntro();
    fireEvent.click(screen.getByRole("button", { name: /sluiten/i }));
    fireEvent.click(screen.getByRole("button", { name: /begrepen/i }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
