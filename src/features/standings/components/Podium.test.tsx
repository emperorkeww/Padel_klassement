import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Podium, type PodiumEntry } from "@/features/standings/components/Podium";
import { bigDaddyCoachQuote } from "@/features/dashboard/bigDaddy";

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

describe("<Podium /> — Coach Rudy bij de #1 (#297)", () => {
  const tierEntries = () => [
    { ...entry("p1", "Alice", 1200), tier: true, link: "/spelers/p1" },
    { ...entry("p2", "Bob", 1100), tier: true },
    { ...entry("p3", "Carol", 1000), tier: true },
  ];

  it("toont Coach Rudy's bubbel met lof + sneer bij een rating-podium", () => {
    renderPodium(tierEntries());
    expect(screen.getByText("Coach Rudy")).toBeInTheDocument();
    expect(
      screen.getByText(bigDaddyCoachQuote("p1", false)),
    ).toBeInTheDocument();
  });

  it("zet de bubbel buiten het grid en buiten de link van de #1", () => {
    const { container } = renderPodium(tierEntries());
    const bubbel = container.querySelector(".coach-sneer");
    expect(bubbel).not.toBeNull();
    expect(container.querySelector(".podium .coach-sneer")).toBeNull();
    expect(bubbel?.closest("a")).toBeNull();
  });

  it("toont geen bubbel op een punten-podium (geen tier)", () => {
    const { container } = renderPodium([
      entry("p1", "Alice", 1200),
      entry("p2", "Bob", 1100),
      entry("p3", "Carol", 1000),
    ]);
    expect(container.querySelector(".coach-sneer")).toBeNull();
    expect(screen.queryByText("Coach Rudy")).not.toBeInTheDocument();
  });

  it("dempt tot neutrale lof als de #1 het roast-schild aan heeft", () => {
    renderPodium([
      { ...entry("p1", "Alice", 1200), tier: true, roastSchild: true },
      { ...entry("p2", "Bob", 1100), tier: true },
    ]);
    expect(
      screen.getByText(bigDaddyCoachQuote("p1", true)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(bigDaddyCoachQuote("p1", false)),
    ).not.toBeInTheDocument();
  });
});
