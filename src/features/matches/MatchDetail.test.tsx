import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import { openBeheer } from "@/test/matchBeheer";
import MatchDetail from "./MatchDetail";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "@/test/supabaseMock";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { MATCH_DONE } from "@/test/fixtures";

function renderPage(id = "m-done") {
  return render(
    <MemoryRouter initialEntries={[`/matches/${id}`]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/matches/:id" element={<MatchDetail />} />
            {/* Waar "terug" bij een deeplink kan landen (#915). Sinds #1123
                is dat de Spelen-hub, want daar staan de matches. */}
            <Route path="/spelen" element={<p>matchoverzicht</p>} />
            <Route path="/groepen/:gid" element={<p>groepspagina</p>} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Beheer & correcties zit sinds #915 achter een inklapper; jsdom toont de
 *  inhoud van een gesloten <details> gewoon, maar een echte browser niet — dus
 *  openen we hem net als een gebruiker. */
/** Vervangt tijdelijk wat de matches-tabel teruggeeft, en desgewenst ook de
 *  groepen-tabel. Dat laatste is nodig sinds #978: de kijker (p1) bezit g1 uit
 *  de fixtures, dus "iemand anders beheert deze groep" bestaat alleen als je
 *  ook de groep vervangt — de mock negeert .eq(), dus een ander group_id
 *  verzinnen levert nog steeds g1 op. */
function metMatch(
  rij: Record<string, unknown>,
  groep?: Record<string, unknown> | null,
) {
  invalidateAll();
  const fromMock = supabase.from as unknown as {
    getMockImplementation: () => (table: string) => unknown;
    mockImplementation: (impl: (table: string) => unknown) => void;
  };
  const orig = fromMock.getMockImplementation();
  fromMock.mockImplementation((t) => {
    if (t === "matches") return makeQuery({ data: [rij], error: null });
    if (t === "groups" && groep !== undefined)
      return makeQuery({ data: groep ? [groep] : [], error: null });
    return orig(t);
  });
  return () => {
    fromMock.mockImplementation(orig);
    invalidateAll();
  };
}

describe("<MatchDetail />", () => {
  it("toont de uitslag met winnaar, teams en badges", async () => {
    renderPage();
    expect(await screen.findByText(/eindstand/i)).toBeInTheDocument();
    expect(await screen.findByText(/winnaar/i)).toBeInTheDocument();
    expect(await screen.findByText(/afgerond/i)).toBeInTheDocument();
    expect(await screen.findByText(/ronde 1/i)).toBeInTheDocument();
    // Groepsbadge met de groepsnaam (sinds #648 noemt ook de koppel-select
    // de groep, vandaar findAll).
    expect(
      (await screen.findAllByText(/vrijdagavond padel/i)).length,
    ).toBeGreaterThan(0);
    // Delen-knop (ShareMatch) is aanwezig bij een afgeronde match.
    expect(await screen.findByText(/delen/i)).toBeInTheDocument();
  });

  it("laat de aanmaker de score corrigeren", async () => {
    renderPage();
    await openBeheer(/score corrigeren/i);
    // Corrigeren gebeurt sinds #1144 in dezelfde sheet als invullen, met
    // dezelfde previewtekst als de wizard.
    const inputA = await screen.findByRole("spinbutton", {
      name: /^score alice anders & bob boers$/i,
    });
    await userEvent.clear(inputA);
    await userEvent.type(inputA, "2");
    // Live voorbeeld: team B wint nu.
    expect(
      await screen.findByText(/carol claes & dave de vos winnen/i),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /score opslaan/i }),
    );
    expect(await screen.findByText(/score bijgewerkt/i)).toBeInTheDocument();
  });

  it("laat een lid van de groep de match loskoppelen (#648)", async () => {
    renderPage();
    // Kijker p1 is lid van g1: de groepssectie toont de select met de huidige
    // groep; kies "Losse match" en sla op → de RPC ontkoppelt.
    await openBeheer(/groep wijzigen/i);
    const select = await screen.findByLabelText(/^groep$/i);
    const opslaan = screen.getByRole("button", { name: /groep opslaan/i });
    // Ongewijzigd = niets op te slaan.
    expect(opslaan).toBeDisabled();
    await userEvent.selectOptions(select, "");
    await userEvent.click(opslaan);
    expect(await screen.findByText(/match losgekoppeld/i)).toBeInTheDocument();
    const { supabase } = await import("@/lib/supabase/client");
    expect(supabase.rpc).toHaveBeenCalledWith("set_match_group", {
      p_match_id: "m-done",
      p_group_id: undefined,
    });
  });

  it("toont de opstelling met chemie-badges", async () => {
    renderPage();
    expect(await screen.findByText(/^opstelling$/i)).toBeInTheDocument();
    // Standaard-fixtures: elk duo heeft maar één gezamenlijke match (m-done),
    // dus beide helften melden "te weinig samen" in plaats van een oordeel.
    // (Op de badge-prefix "Chemie:" matchen — de uitleg noemt de zin ook.)
    await waitFor(() =>
      expect(
        screen.getAllByText(/chemie: nog te weinig samen/i),
      ).toHaveLength(2),
    );
  });

  it("toont Elo delta's, divisies en eventuele divisiewissels per speler", async () => {
    renderPage();
    // De spelersregel verschijnt pas als zowel de profielen als de
    // rating-historie binnen zijn — twee losse queries. Op een trage runner
    // haalt dat de standaard 1s van findBy niet, vandaar de ruimere timeout.
    // Zodra deze er staat, zit de rest van de regel in dezelfde render.
    expect(
      await screen.findByText(/1012 ELO/i, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/▲7/i)).toBeInTheDocument();
    // Check that the TierBadge is rendered (sinds #495 noemt ook de
    // divisieregel op de lineup-kaart de tier, vandaar findAll).
    expect((await screen.findAllByText(/Wannabe III/i)).length).toBeGreaterThan(
      0,
    );
  });

  // ── #915 ────────────────────────────────────────────────────────────────

  // #915 stopte beheer in een inklapper op de pagina; #1144 maakte er één
  // ⋯-menu van, zodat er niet langer twee beheerplekken naast elkaar staan.
  it("stopt beheer & correcties achter één ⋯-menu", async () => {
    renderPage();
    await screen.findByText(/eindstand/i);

    // Niet los op de pagina: de groepskoppeling is er pas ná het menu.
    expect(screen.queryByLabelText(/^groep$/i)).toBeNull();
    await openBeheer(/groep wijzigen/i);
    const select = await screen.findByLabelText(/^groep$/i);
    expect(select.closest('[role="dialog"]')).not.toBeNull();
    // Wat over de wedstrijd zelf gaat blijft er buiten.
    expect(
      screen.getByText(/eindstand/i).closest('[role="dialog"]'),
    ).toBeNull();
  });

  it("legt uit dat alleen de invoerder de score kan aanpassen", async () => {
    // Zelfde match, maar ingevoerd door Carol (p3) in plaats van de kijker, en
    // bewust zonder groep: de kijker bezit g1, en sinds #978 zou hij daar wél
    // mogen corrigeren.
    const herstel = metMatch({
      ...MATCH_DONE,
      created_by: "p3",
      group_id: null,
    });
    try {
      renderPage();
      await screen.findByText(/eindstand/i);
      await openBeheer();
      expect(
        screen.queryByRole("button", { name: /score corrigeren/i }),
      ).toBeNull();
      // De naam komt uit de profielen van deze match; die laden apart.
      await waitFor(() =>
        expect(
          screen.getByText(/alleen wie de uitslag invoerde kan hem aanpassen/i),
        ).toHaveTextContent(/carol/i),
      );
    } finally {
      herstel();
    }
  });

  it("noemt de groepsbeheerder als medecorrector (#978)", async () => {
    // Ingevoerd door Carol, in een groep die de kijker níét bezit.
    const herstel = metMatch(
      { ...MATCH_DONE, created_by: "p3", group_id: "g-vreemd" },
      { id: "g-vreemd", name: "Andermans groep", created_by: "p3" },
    );
    try {
      renderPage();
      await screen.findByText(/eindstand/i);
      await openBeheer();
      expect(
        screen.queryByRole("button", { name: /score corrigeren/i }),
      ).toBeNull();
      await waitFor(() =>
        expect(
          screen.getByText(/beheerder van de groep kan deze uitslag aanpassen/i),
        ).toHaveTextContent(/carol/i),
      );
    } finally {
      herstel();
    }
  });

  it("laat de groepseigenaar een uitslag van iemand anders corrigeren (#978)", async () => {
    // Carol voerde de uitslag in, maar de kijker (p1) bezit groep g1.
    const herstel = metMatch({ ...MATCH_DONE, created_by: "p3" });
    try {
      renderPage();
      await screen.findByText(/eindstand/i);
      expect(
        await screen.findByText(/jij beheert deze groep/i),
      ).toBeInTheDocument();
      await openBeheer();
      expect(
        await screen.findByRole("button", { name: /score corrigeren/i }),
      ).toBeInTheDocument();
    } finally {
      herstel();
    }
  });

  it("zegt de aanmaker waaróm hij mag corrigeren", async () => {
    renderPage();
    await screen.findByText(/eindstand/i);
    expect(
      screen.getByText(/jij voerde deze uitslag in/i),
    ).toBeInTheDocument();
    await openBeheer();
    expect(
      await screen.findByRole("button", { name: /score corrigeren/i }),
    ).toBeInTheDocument();
  });

  it("klapt de uitleg bij een momenten-chip uit — ook zonder hover", async () => {
    // 6-0 levert de bagel-chip op; de fixture-uitslag (6-3) heeft geen enkel
    // bijzonder moment.
    const herstel = metMatch({ ...MATCH_DONE, score_a: 6, score_b: 0 });
    try {
      renderPage();
      await screen.findByText(/eindstand/i);

      const chip = await screen.findByRole("button", { name: /droog/i });
      // De uitleg zat in een `title` en was op touch onbereikbaar.
      expect(chip).not.toHaveAttribute("title");
      expect(chip).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText(/geen enkele game/i)).toBeNull();

      await userEvent.click(chip);
      expect(chip).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText(/geen enkele game/i)).toBeInTheDocument();

      // Nogmaals tikken sluit hem weer.
      await userEvent.click(chip);
      expect(screen.queryByText(/geen enkele game/i)).toBeNull();
    } finally {
      herstel();
    }
  });

  it("gaat bij een deeplink terug naar de groep van de match", async () => {
    // MemoryRouter heeft geen browserhistorie, dus useBackTo pakt het vangnet —
    // precies het pad dat een deeplink uit een pushbericht volgt.
    renderPage();
    await screen.findByText(/eindstand/i);
    await userEvent.click(screen.getByRole("button", { name: /terug/i }));
    expect(await screen.findByText("groepspagina")).toBeInTheDocument();
  });

  it("valt zonder groep terug op het matchoverzicht", async () => {
    const herstel = metMatch({ ...MATCH_DONE, group_id: null });
    try {
      renderPage();
      await screen.findByText(/eindstand/i);
      await userEvent.click(screen.getByRole("button", { name: /terug/i }));
      expect(await screen.findByText("matchoverzicht")).toBeInTheDocument();
    } finally {
      herstel();
    }
  });
});

// Op 390px stapelde het matchdetail drie kaartniveaus, stond de eindstand
// tússen de teams en droegen beide teamblokken een groenige tint (#948).
describe("<MatchDetail /> — leesbaar op telefoonformaat (#948)", () => {
  const MD_CSS = readFileSync("src/features/matches/MatchDetail.css", "utf8");

  it("laat de uitslag de kleur dragen zodra er gespeeld is", async () => {
    const { container } = renderPage();
    await screen.findByText(/eindstand/i);
    // De teamtinten wijken voor de uitslag; de winnaar houdt zijn blok én zijn
    // chip, de verliezer wordt neutraal.
    expect(container.querySelector(".md-versus")).toHaveClass("is-done");
    expect(MD_CSS).toMatch(
      /\.md-versus\.is-done \.md-team\s*\{[^}]*background:\s*var\(--surface\)/,
    );
    expect(MD_CSS).toMatch(
      /\.md-versus\.is-done \.md-team\.is-win\s*\{[^}]*background:\s*var\(--success-soft\)/,
    );
    // En de winnaar staat er in woorden, niet alleen in kleur.
    expect(container.querySelector(".md-team.is-win .badge--win")).toHaveTextContent(
      /winnaar/i,
    );
  });

  it("zet de eindstand vóór de teamblokken op smalle schermen", () => {
    // Gestapeld in DOM-volgorde stond hij tússen de teams: dan moet je scrollen
    // om te zien wie won.
    const smal = MD_CSS.slice(MD_CSS.indexOf("@media (max-width: 560px)"));
    expect(smal).toMatch(/\.md-score\s*\{[^}]*order:\s*-1/);
  });

  it("houdt het bij twee kaartniveaus", () => {
    // De spelerrij was een derde kaart in de kaart in de kaart; dat kostte op
    // 390px ~48px horizontale ruimte.
    expect(MD_CSS).not.toMatch(
      /\.md-team__players \.md-player\s*\{[^}]*border:\s*1px solid/,
    );
    expect(MD_CSS).toMatch(
      /\.md-team__players \.md-player \+ \.md-player\s*\{\s*border-top:/,
    );
  });

  it("tekent de promotie- en winnaarschips in plaats van emoji", async () => {
    const { container } = renderPage();
    await screen.findByText(/eindstand/i);
    expect(container.innerHTML).not.toMatch(/⬆️|⬇️/);
    expect(
      container.querySelector(".md-team__winnaar svg"),
    ).toBeInTheDocument();
  });
});
