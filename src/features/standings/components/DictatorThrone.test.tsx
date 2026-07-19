import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DictatorThrone } from "./DictatorThrone";

function renderThrone(props?: Partial<Parameters<typeof DictatorThrone>[0]>) {
  return render(
    <MemoryRouter>
      <DictatorThrone
        seed="p1"
        name="Brecht"
        profile={null}
        rating={1687}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("<DictatorThrone /> (#528)", () => {
  it("toont een dictator-insigne i.p.v. een rangnummer", () => {
    const { container } = renderThrone();
    expect(screen.getByText(/Dictator/)).toBeInTheDocument();
    // Geen podium-medaille / kaal rangnummer op de troon.
    expect(container.querySelector(".podium__medal")).toBeNull();
  });

  it("toont de El Padelissimo-tierbadge en de rating als hoofdgetal", () => {
    renderThrone();
    expect(screen.getByText(/El Padelissimo/)).toBeInTheDocument();
    expect(screen.getByText("1687")).toBeInTheDocument();
  });

  it("toont een propaganda-ondertitel (deterministisch per seed)", () => {
    const { container } = renderThrone();
    const prop = container.querySelector(".dictator-throne__prop");
    expect(prop?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it("linkt naar het profiel wanneer een link is meegegeven", () => {
    renderThrone({ link: "/spelers/p1" });
    expect(screen.getByRole("link")).toHaveAttribute("href", "/spelers/p1");
  });

  it("markeert de kijker met een 'jij'-badge", () => {
    renderThrone({ isMe: true });
    expect(screen.getByText("jij")).toBeInTheDocument();
  });
});

describe("<DictatorThrone /> — waarnemend (#530)", () => {
  function renderWaarnemend(
    props?: Partial<Parameters<typeof DictatorThrone>[0]>,
  ) {
    return render(
      <MemoryRouter>
        <DictatorThrone
          variant="waarnemend"
          seed="kylian-mbappe"
          name="Kylian Mbappé"
          profile={null}
          rating={null}
          {...props}
        />
      </MemoryRouter>,
    );
  }

  it("toont een 'regeert bij verstek'-label i.p.v. een ambtstermijn/tierbadge", () => {
    const { container } = renderWaarnemend();
    // Exacte match: het chip-label (niet de langere propaganda-zin).
    expect(screen.getByText("Sportief Directeur bij verstek")).toBeInTheDocument();
    expect(container.querySelector(".tier-badge")).toBeNull();
    // Geen rating-hoofdgetal voor een waarnemend dictator.
    expect(container.querySelector(".dictator-throne__rate")).toBeNull();
    expect(container.querySelector(".dictator-throne")).toHaveClass(
      "dictator-throne--waarnemend",
    );
  });

  it("linkt niet naar een spelerprofiel, ook niet met een link-prop", () => {
    renderWaarnemend({ link: "/spelers/x" });
    expect(screen.queryByRole("link")).toBeNull();
  });
});
