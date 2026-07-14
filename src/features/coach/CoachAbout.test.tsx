import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CoachAbout } from "@/features/coach/CoachAbout";

function renderAbout(props = {}) {
  return render(
    <MemoryRouter>
      <CoachAbout {...props} />
    </MemoryRouter>,
  );
}

describe("<CoachAbout />", () => {
  it("legt de twee controls uit met vindbare links", () => {
    renderAbout();
    expect(screen.getByText(/roast-schild/i)).toBeInTheDocument();
    expect(screen.getByText(/roast-intensiteit/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /privacy-instellingen/i }),
    ).toHaveAttribute("href", "/profiel");
    expect(
      screen.getByRole("link", { name: /groep-instellingen/i }),
    ).toHaveAttribute("href", "/spelen");
  });

  it("toont de 'Coach afstellen'-knop alleen met showSettingsLink", () => {
    const { rerender } = renderAbout();
    expect(
      screen.queryByRole("link", { name: /coach afstellen/i }),
    ).not.toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <CoachAbout showSettingsLink />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: /coach afstellen/i }),
    ).toHaveAttribute("href", "/profiel");
  });

  it("roept onNavigate aan bij een link-klik", () => {
    const onNavigate = vi.fn();
    renderAbout({ onNavigate });
    screen.getByRole("link", { name: /privacy-instellingen/i }).click();
    expect(onNavigate).toHaveBeenCalled();
  });
});
