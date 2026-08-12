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

describe("spelerspillen in het match-sheet (#1083)", () => {
  const tsx = lees("src/features/matches/components/NewMatchSheet.tsx");
  // Sinds #1183 wonen de sheet-stijlen naast de component in plaats van in
  // Matches.css, zodat elke route die het sheet opent ze meelaadt.
  const css = lees("src/features/matches/components/NewMatchSheet.css");
  const blok = css.match(/\n\.pick-chip \{([\s\S]*?)\n\}/)![1];

  it("draagt het materiaal alleen als de speler gekozen is (#1183)", () => {
    // Elke pil het materiaal geven maakte het betekenisloos: twintig
    // lichtgevende vlakken in één scrollende lijst, waarin je selectie juist
    // het zwakste signaal was. De classes staan daarom aan de team-tak van de
    // ternary vast en niet los in de markup.
    expect(tsx).toMatch(/pick-chip--\$\{team\} glas glas--interactief/);
    expect(tsx).not.toMatch(/pick-chip glas/);
  });

  it("houdt de vulling dekkend en de blur uit", () => {
    // Er staan er twintig-plus tegelijk in een scrollende lijst; twintig
    // backdrop-filters op een telefoon is geen optie, en onder een dekkende
    // vulling zou je er toch niets van zien. Zelfde afweging als .me-chip.
    // Sinds #1183 staat dit op de gekozen pil, want alleen die draagt .glas.
    const gekozen = css.match(/\n\.pick-chip\.glas \{([\s\S]*?)\n\}/)![1];
    expect(gekozen).toMatch(/backdrop-filter:\s*none/);
    // Op de declaratie en niet op het woord: de comment in .pick-chip legt uit
    // waaróm de vulling via die laag gaat.
    expect(blok).not.toMatch(/^\s*--glas-laag:/m);
  });

  it("wisselt de teamkleur via de laag en niet via background", () => {
    // Een `background` hier zou het hele materiaal eronder wegvegen.
    for (const team of ["a", "b"]) {
      const teamBlok = css.match(
        new RegExp(`\\n\\.pick-chip--${team} \\{([\\s\\S]*?)\\n\\}`),
      )![1];
      expect(teamBlok).toMatch(/--glas-laag:\s*linear-gradient\(/);
      expect(teamBlok).not.toMatch(/^\s*background:/m);
    }
  });

  it("houdt de vorm gelijk tussen rust en gekozen", () => {
    // De afronding kwam van .glas--pil, die alleen op de gekozen pil zou
    // staan; dan zou de pil van vorm veranderen op het moment dat je aantikt.
    // Hij hoort dus op .pick-chip zelf.
    expect(blok).toMatch(/border-radius:\s*999px/);
    // .glas--pil hoort hier niet meer; elders in dit sheet (de keuzebanen)
    // blijft hij wel staan, vandaar de pick-chip-context in de regex.
    expect(tsx).not.toMatch(/pick-chip[^`]*glas--pil/);
  });
});

describe("keuzebanen in het match-sheet (#1083)", () => {
  const tsx = lees("src/features/matches/components/NewMatchSheet.tsx");

  it("zet de baan op glas, maar alleen binnen het sheet", () => {
    // Speelvorm, baantype en sinds #1123 de keuze loggen/plannen liggen op een
    // glazen sheet; een dekkende --surface-2 las daar als een grijze plaat.
    // Elders in de app ligt .tabs op een dichte pagina en blijft hij zoals hij
    // is — vandaar per instantie en niet in de gedeelde .tabs-regel.
    //
    // Geteld tegen het totaal in plaats van tegen een vast getal: een nieuwe
    // keuzebaan in dit sheet moet mee op glas, en dat is precies wat hier
    // misgaat als iemand hem vergeet.
    const alle = tsx.match(/className="tabs\b/g) ?? [];
    const opGlas = tsx.match(/tabs[^"`]*glas glas--subtiel glas--pil/g) ?? [];
    expect(alle.length).toBeGreaterThan(0);
    expect(opGlas).toHaveLength(alle.length);
  });
});

describe("sticky selectiebalk van de poll-wizard (#1083)", () => {
  const tsx = lees("src/features/groups/components/PollWizard.tsx");
  const css = lees("src/features/groups/Proposals.css");
  const blok = css.match(/\n\.wizard-footer \{([\s\S]*?)\n\}/)![1];

  it("draagt het materiaal als balk", () => {
    expect(tsx).toMatch(/className="wizard-footer glas glas--sterk glas--balk"/);
  });

  it("heeft geen dekkende vulling meer", () => {
    // Dit is de bug uit #1083: op een glazen sheet werd `background: --surface`
    // een wit blok met rechte hoeken en een strook glas ernaast. De balk moet
    // frosten wat eronderdoor scrolt, niet dichtplakken.
    expect(blok).not.toMatch(/^\s*background:/m);
    expect(blok).toMatch(/--glas-schaduw:\s*var\(--shadow-up\)/);
  });

  it("loopt in het sheet van rand tot rand", () => {
    // Zonder deze negatieve marge blijft de zijpadding van .sheet als glasstrook
    // naast de balk staan — precies wat de screenshot in #1083 laat zien.
    const inSheet = css.match(/\.sheet--wizard \.wizard-footer \{([\s\S]*?)\n\}/)![1];
    expect(inSheet).toMatch(/margin-inline:\s*calc\(var\(--sp-5\) \* -1\)/);
    expect(inSheet).toMatch(/padding-inline:\s*var\(--sp-5\)/);
    // De scheidingslijn moet donker zijn: het witte bovenlicht van .glas--balk
    // is op het lichte thema onzichtbaar.
    expect(inSheet).toMatch(/border-top:\s*1px solid rgb\(var\(--glas-diep\)/);
  });
});

describe("speeldagblok in het dag-sheet (#1207)", () => {
  const tsx = lees("src/features/agenda/components/DagSheet.tsx");
  const css = lees("src/features/agenda/Agenda.css");
  const blok = css.match(
    /\n\.dagsheet--meerdere \.dagsheet__speeldag \{([\s\S]*?)\n\}/,
  )![1];

  it("draagt het materiaal alleen als er meer dan één speeldag staat", () => {
    // Aan `eigenVlak` en niet los in de markup: het enige blok op een dag blijft
    // bewust randloos, en dan hoort er ook geen tweede ruitje op het sheet te
    // liggen. Zelfde afweging als bij .pick-chip, waar alleen de gekozen pil het
    // materiaal draagt.
    expect(tsx).toMatch(
      /dagsheet__speeldag\$\{eigenVlak \? " glas glas--subtiel" : ""\}/,
    );
    expect(tsx).toMatch(/eigenVlak=\{markers\.length > 1\}/);
  });

  it("heeft geen dekkende vulling en geen eigen rand meer", () => {
    // Dit is de bug uit #1207, en dezelfde als op de wizard-voet in #1083: op
    // een glazen sheet werden twee `background: --surface`-blokken witte kaarten
    // die het materiaal doodgedrukten. Rand en vulling komen van .glas.
    expect(blok).not.toMatch(/^\s*background:/m);
    expect(blok).not.toMatch(/^\s*border(-top)?:/m);
  });

  it("houdt zijn eigen afronding", () => {
    // Geen vormklasse: .glas--paneel zou --radius-lg opdringen, en dit blok is
    // een tegel binnen het sheet en geen paneel eromheen.
    expect(blok).toMatch(/border-radius:\s*12px/);
    expect(tsx).not.toMatch(/dagsheet__speeldag[^`]*glas--(paneel|pil|cirkel)/);
  });
});
