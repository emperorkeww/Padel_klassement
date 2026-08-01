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
    fireEvent.click(
      screen.getByRole("button", { name: /kennismaking sluiten/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /begrepen/i }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  // De volle tekst was ~10 regels bovenaan de feed en duwde op 390px elk
  // feed-item onder de vouw (#944).
  it("houdt het lange verhaal ingeklapt", () => {
    renderIntro();
    // De teaser staat er; het WK-verhaal zit achter de uitklapper.
    expect(screen.getByText(/maak je borst maar nat/i)).toBeInTheDocument();
    const meer = screen.getByText(/meer over coach rudy/i);
    expect(meer.closest("details")).not.toHaveAttribute("open");
    // Ingeklapt betekent niet weg: de tekst blijft in de DOM en klapt open.
    expect(screen.getByText(/legendarische wissel/i)).toBeInTheDocument();
  });
});
