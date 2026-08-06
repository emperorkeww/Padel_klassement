import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Waar het glasmateriaal wordt gebruikt (#1062).
 *
 * Deze suite is de inventaris: welke vlakken dragen het materiaal, en met welke
 * afspraken. Dat is bewust op de bron gecontroleerd. De echte garanties zitten
 * in CSS die jsdom niet uitrekent, en de componenten eromheen (het klassement,
 * het dashboard) optuigen kost een half mock-apparaat voor één classnaam.
 */

const lees = (pad: string) => readFileSync(pad, "utf8");

describe("dashboardkaart 'Jouw volgende match'", () => {
  const tsx = lees("src/features/dashboard/components/NextMatchCard.tsx");
  const css = lees("src/features/dashboard/Dashboard.css");

  it("draagt het standaard-materiaal", () => {
    expect(tsx).toMatch(/className="card card--next glas glas--standaard"/);
  });

  it("brengt zijn accentgloed mee als doorschijnende laag", () => {
    // Niet als `background`: dat zou het materiaal eronder wegvegen. En niet
    // dekkend: dan zou juist de linkerbovenhoek het enige ondoorzichtige stuk
    // van de kaart zijn.
    const blok = css.match(/\.card--next \{([\s\S]*?)\n\}/)![1];
    expect(blok).toMatch(/--glas-laag:\s*radial-gradient/);
    expect(blok).toMatch(/color-mix\(in srgb, var\(--accent\) 14%, transparent\)/);
    expect(blok).not.toMatch(/^\s*background:/m);
  });
});

describe("'Jouw positie'-chip", () => {
  const tsx = lees("src/features/standings/Leaderboard.tsx");
  const css = lees("src/features/standings/Leaderboard.css");
  const blok = css.match(/\n\.me-chip \{([\s\S]*?)\n\}/)![1];

  it("draagt het interactieve materiaal in pilvorm", () => {
    expect(tsx).toMatch(/me-chip zwevende-actie glas glas--interactief glas--pil/);
  });

  it("laat het hooglicht de aanwijzer volgen", () => {
    expect(tsx).toMatch(/useGlasAanwijzer\(\)/);
    expect(tsx).toMatch(/\{\.\.\.chipAanwijzer\}/);
  });

  it("houdt de vulling dekkend", () => {
    // Wit op --accent haalt net AA (een paar dat contrast-check.mjs bewaakt).
    // Laat je daar achtergrond doorheen schijnen, dan zakt het eronder. Het
    // glas zit hier dus in de rand en het licht, niet in de doorkijk — en dan
    // is de blur alleen nog werk zonder zichtbaar resultaat.
    expect(blok).toMatch(/--glas-laag:\s*linear-gradient\(var\(--accent\) 0 0\)/);
    expect(blok).toMatch(/backdrop-filter:\s*none/);
  });

  it("laat de pilvorm de afronding doen", () => {
    // Stond hier eerst als border-radius: 999px; nu komt dat van .glas--pil.
    expect(blok).not.toMatch(/border-radius/);
  });
});
