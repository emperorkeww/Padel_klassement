import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "@/ui/EmptyState";

describe("<EmptyState />", () => {
  it("toont icoon, titel en uitleg", () => {
    render(
      <EmptyState icon="🎾" title="Nog geen matches.">
        Log je eerste uitslag.
      </EmptyState>,
    );
    expect(screen.getByText("🎾")).toBeInTheDocument();
    expect(screen.getByText("Nog geen matches.")).toBeInTheDocument();
    expect(screen.getByText("Log je eerste uitslag.")).toBeInTheDocument();
  });

  it("rendert de optionele actie en die blijft klikbaar", async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon="🎾"
        title="Leeg"
        action={<button onClick={onClick}>Doe iets</button>}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Doe iets" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("laat uitleg en actie weg als ze niet meegegeven zijn", () => {
    const { container } = render(<EmptyState icon="🎾" title="Leeg" />);
    expect(container.querySelector(".empty-state__text")).toBeNull();
    expect(container.querySelector(".empty-state__action")).toBeNull();
  });
});
