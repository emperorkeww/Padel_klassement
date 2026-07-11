import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Podium, type PodiumEntry } from "./Podium";

function entry(key: string, name: string, rating: number): PodiumEntry {
  return { key, name, profile: null, rating };
}

function renderPodium(entries: PodiumEntry[]) {
  return render(
    <MemoryRouter>
      <Podium entries={entries} />
    </MemoryRouter>,
  );
}

describe("<Podium /> — Big Daddy", () => {
  it("kroont de #1 van een rating-podium (tier) tot Big Daddy", () => {
    renderPodium([
      { ...entry("p1", "Alice", 1200), tier: true },
      { ...entry("p2", "Bob", 1100), tier: true },
      { ...entry("p3", "Carol", 1000), tier: true },
    ]);
    // Kroon + titel staan op de #1.
    const crown = screen.getByText(/Big Daddy/);
    expect(crown).toBeInTheDocument();
    // De kroon hangt aan de #1-plek, die de roze modifier draagt.
    expect(crown.closest(".podium__spot--1")).toHaveClass("is-bigdaddy");
    // Alice is de leider, niet Bob/Carol.
    expect(crown.closest(".podium__spot")).toHaveTextContent("Alice");
  });

  it("kroont alleen de #1, niet zilver of brons", () => {
    const { container } = renderPodium([
      { ...entry("p1", "Alice", 1200), tier: true },
      { ...entry("p2", "Bob", 1100), tier: true },
      { ...entry("p3", "Carol", 1000), tier: true },
    ]);
    expect(container.querySelectorAll(".is-bigdaddy")).toHaveLength(1);
    expect(container.querySelectorAll(".podium__crown")).toHaveLength(1);
  });

  it("kroont niets op een punten-podium (geen tier)", () => {
    const { container } = renderPodium([
      entry("p1", "Alice", 1200),
      entry("p2", "Bob", 1100),
      entry("p3", "Carol", 1000),
    ]);
    expect(screen.queryByText(/Big Daddy/)).not.toBeInTheDocument();
    expect(container.querySelector(".is-bigdaddy")).toBeNull();
  });
});
