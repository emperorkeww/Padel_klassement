import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Podium, type PodiumEntry } from "@/features/standings/components/Podium";

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

describe("<Podium /> — De Troon (#528)", () => {
  it("kroont niemand als bigDaddy uit staat (dictator staat al op de troon)", () => {
    const { container } = render(
      <MemoryRouter>
        <Podium
          bigDaddy={false}
          entries={[
            { ...entry("p2", "Bob", 1543), tier: true },
            { ...entry("p3", "Carol", 1498), tier: true },
            { ...entry("p4", "Dan", 1471), tier: true },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Big Daddy/)).not.toBeInTheDocument();
    expect(container.querySelector(".is-bigdaddy")).toBeNull();
    expect(container.querySelector(".podium__crown")).toBeNull();
  });

  it("toont het echte rangnummer op de medaille via `medal` (volk begint bij #2)", () => {
    const { container } = render(
      <MemoryRouter>
        <Podium
          bigDaddy={false}
          entries={[
            { ...entry("p2", "Bob", 1543), tier: true, medal: 2 },
            { ...entry("p3", "Carol", 1498), tier: true, medal: 3 },
            { ...entry("p4", "Dan", 1471), tier: true, medal: 4 },
          ]}
        />
      </MemoryRouter>,
    );
    const medals = Array.from(
      container.querySelectorAll(".podium__medal"),
    ).map((n) => n.textContent);
    // Visuele volgorde zilver — goud — brons ⇒ 3 · 2 · 4.
    expect(medals).toEqual(["3", "2", "4"]);
  });
});

describe("<Podium /> — geen Coach Rudy over de #1 (#411)", () => {
  it("toont geen bubbel over de nummer 1 — Rudy spreekt alleen de kijker aan", () => {
    // De vroegere Big-Daddy-bubbel (#297) is vervallen: klassement-commentaar
    // gaat via KlassementCommentaar over de ingelogde speler zelf.
    const { container } = renderPodium([
      { ...entry("p1", "Alice", 1200), tier: true, link: "/spelers/p1" },
      { ...entry("p2", "Bob", 1100), tier: true },
      { ...entry("p3", "Carol", 1000), tier: true },
    ]);
    expect(container.querySelector(".coach-sneer")).toBeNull();
    expect(screen.queryByText("Coach Rudy")).not.toBeInTheDocument();
  });
});
