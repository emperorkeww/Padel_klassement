import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("toont 'regeert sinds <datum>' wanneer een ambtstermijn is meegegeven (#545)", () => {
    renderThrone({ sinds: "2026-07-01T10:00:00Z" });
    expect(screen.getByText(/regeert sinds/i)).toBeInTheDocument();
    expect(screen.getByText(/1 jul/i)).toBeInTheDocument();
  });

  it("laat het ambtstermijn-label weg als er geen sinds is", () => {
    const { container } = renderThrone();
    expect(container.querySelector(".dictator-throne__sinds")).toBeNull();
  });

  it("zet het insigne in de topline en niet meer op het portret-kader (#609)", () => {
    const { container } = renderThrone();
    expect(
      container.querySelector(".dictator-throne__topline .dictator-throne__insig"),
    ).not.toBeNull();
    expect(
      container.querySelector(".dictator-throne__frame .dictator-throne__insig"),
    ).toBeNull();
  });

  it("draagt de titel op een plaquette met embleem en lakzegel (#769)", () => {
    const { container } = renderThrone();
    const plaquette = container.querySelector(".dictator-throne__plaquette");
    expect(plaquette).not.toBeNull();
    // Titel, commandoster-embleem en lakzegel horen bij elkaar op één plaat.
    expect(plaquette?.querySelector(".dictator-throne__insig")).not.toBeNull();
    expect(plaquette?.querySelector(".dictator-throne__embleem")).not.toBeNull();
    expect(plaquette?.querySelector(".dictator-throne__lakzegel")).not.toBeNull();
  });

  it("gebruikt SVG-emblemen en géén emoji op de kaart (#769)", () => {
    const { container } = renderThrone();
    const kaart = container.querySelector(".dictator-throne");
    // Geen geit: die hoort uitsluitend bij GOAT (#769).
    expect(kaart?.textContent ?? "").not.toMatch(/🐐/u);
    // En op de plaquette zelf staat helemáál geen emoji — die rendert per
    // platform anders, dus daar doet het SVG-embleem het werk.
    expect(
      container.querySelector(".dictator-throne__plaquette")?.textContent ?? "",
    ).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(container.querySelector(".dictator-throne__embleem")).toBeInstanceOf(
      SVGElement,
    );
  });

  it("verbergt alle decoratieve SVG-lagen voor screenreaders (#769)", () => {
    const { container } = renderThrone();
    const svgs = Array.from(container.querySelectorAll(".dictator-throne svg"));
    expect(svgs.length).toBeGreaterThan(0);
    expect(
      svgs.every((svg) => svg.getAttribute("aria-hidden") === "true"),
    ).toBe(true);
  });

  it("laat een lange naam volledig in de nameplate staan (#769)", () => {
    const lang = "Aleksander Vandenbergh-Descamps van der Meulenbroek";
    const { container } = renderThrone({ name: lang });
    const naam = container.querySelector(".dictator-throne__name");
    // Geen afkapping in de DOM: het inkorten is puur CSS (line-clamp), zodat
    // screenreaders en zoeken de hele naam houden.
    expect(naam?.textContent).toContain(lang);
  });
});

describe("<DictatorThrone /> — staatsportret (#769)", () => {
  function renderMetPortret(
    props?: Partial<Parameters<typeof DictatorThrone>[0]>,
  ) {
    return render(
      <MemoryRouter>
        <DictatorThrone
          seed="p1"
          name="Brecht"
          profile={null}
          rating={1687}
          image="https://voorbeeld.test/portret.webp"
          {...props}
        />
      </MemoryRouter>,
    );
  }

  it("geeft het portret een beschrijvende alt-tekst", () => {
    renderMetPortret();
    expect(screen.getByAltText("Staatsportret van Brecht")).toBeInTheDocument();
  });

  it("toont een laadstatus tot de afbeelding binnen is", () => {
    const { container } = renderMetPortret();
    expect(container.querySelector(".dictator-throne__skelet")).not.toBeNull();
    expect(
      container.querySelector(".dictator-throne__portrait"),
    ).toHaveAttribute("data-status", "laadt");

    fireEvent.load(screen.getByAltText("Staatsportret van Brecht"));
    expect(container.querySelector(".dictator-throne__skelet")).toBeNull();
    expect(
      container.querySelector(".dictator-throne__portrait"),
    ).toHaveAttribute("data-status", "klaar");
  });

  it("valt bij een fout terug op het embleem en meldt dat hoorbaar", () => {
    const { container } = renderMetPortret();
    fireEvent.error(screen.getByAltText("Staatsportret van Brecht"));

    expect(container.querySelector(".dictator-throne__img")).toBeNull();
    expect(container.querySelector(".dictator-throne__leeg")).not.toBeNull();
    expect(
      container.querySelector(".dictator-throne__portrait"),
    ).toHaveAttribute("data-status", "fout");
    expect(screen.getByRole("status")).toHaveTextContent(
      /kon niet geladen worden/i,
    );
  });

  it("valt zonder portret terug op de avatar van het clublid", () => {
    const { container } = renderMetPortret({ image: undefined });
    expect(container.querySelector(".avatar")).not.toBeNull();
    expect(container.querySelector(".dictator-throne__skelet")).toBeNull();
  });

  it("toont de ambtstermijn bij de rating i.p.v. op de nameplate (#609)", () => {
    const { container } = renderThrone({ sinds: "2026-07-01T10:00:00Z" });
    expect(
      container.querySelector(".dictator-throne__rate .dictator-throne__sinds"),
    ).not.toBeNull();
    expect(
      container.querySelector(".dictator-throne__plate .dictator-throne__sinds"),
    ).toBeNull();
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
    expect(screen.getByText("Madrid-Dictator")).toBeInTheDocument();
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

  it("draagt GENERALISSIMO op de plaquette, zonder geiticoon (#769)", () => {
    const { container } = renderWaarnemend();
    expect(
      container.querySelector(".dictator-throne__insig")?.textContent,
    ).toBe("Generalissimo");
    expect(container.querySelector(".dictator-throne")?.textContent ?? "").not.toMatch(
      /🐐/u,
    );
  });

  it("houdt een leeg kader i.p.v. initialen zolang het portret ontbreekt (#555)", () => {
    const { container } = renderWaarnemend();
    expect(container.querySelector(".avatar")).toBeNull();
    expect(container.querySelector(".dictator-throne__leeg")).not.toBeNull();
  });

  it("houdt de volkslied-knop als echte, focusbare knop (#535)", () => {
    renderWaarnemend({
      anthem: {
        playing: true,
        blocked: false,
        muted: false,
        onToggleMute: () => {},
        onStart: () => {},
      },
    });
    const knop = screen.getByRole("button");
    knop.focus();
    expect(knop).toHaveFocus();
    expect(knop).toHaveAttribute("aria-pressed", "false");
  });
});

// Op 390px vulde de troonkaart een heel scherm: het staatsportret is 280px
// breed met aspect-ratio 11/12, dus ruim 300px hoog, met het paneel er nog
// onder — en de eerste klassementrij lag daardoor een volledige veeg verderop
// (#943).
describe("<DictatorThrone /> — compact op telefoonformaat (#943)", () => {
  const THROONCSS = readFileSync(
    "src/features/standings/components/DictatorThrone.css",
    "utf8",
  );

  it("krimpt het staatsportret onder 560px", () => {
    const smal = THROONCSS.slice(THROONCSS.indexOf("@media (max-width: 560px)"));
    expect(smal).toMatch(
      /\.dictator-throne__frame\s*\{\s*width:\s*min\(185px, 58%\)/,
    );
    // En de nameplate krimpt mee, anders schuift ze over het gezicht heen.
    expect(smal).toMatch(/\.dictator-throne__plate\s*\{[^}]*padding:/);
  });

  it("houdt de brede opbouw voor tablet en desktop", () => {
    // De twee-koloms opbouw vanaf 640px blijft ongemoeid.
    expect(THROONCSS).toMatch(/@media \(min-width: 640px\)/);
  });
});
