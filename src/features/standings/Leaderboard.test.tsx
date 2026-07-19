import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { makeSupabaseMock } from "@/test/supabaseMock";
import { TABLES, SESSION, TEAMS, PROFILES, MATCH_DONE, MATCH_PLANNED } from "@/test/fixtures";
import {
  computePlayerStandings,
  computeTeamStandings,
} from "@/features/rating/standings";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";
import { NIEUW } from "@/features/coach/klassementPraat";
import type { Match, Profile, Team } from "@/types";

// Vast "nu" (3 juli 2026, Q3): zo is Q2 2026 een afgesloten seizoen met een
// kampioen. Alleen Date wordt gefaket, zodat waitFor/findBy gewoon blijven werken.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 6, 3, 12) });
});
afterAll(() => {
  vi.useRealTimers();
});

vi.mock("@/lib/supabase/client", () => {
  // Afgeronde match in Q2 2026, gewonnen door t-cd (Carol & Dave).
  const MATCH_Q2 = {
    ...MATCH_DONE,
    id: "m-q2",
    winner_team_id: "t-cd",
    score_a: 3,
    score_b: 6,
    played_at: "2026-05-10T10:00:00.000Z",
    created_at: "2026-05-10T10:00:00.000Z",
  };
  // De globale seizoensstand komt sinds #461 van een SECURITY DEFINER RPC met
  // een datumvenster. De mock filtert zelf niet, dus we bootsen de RPC na: de
  // afgeronde fixtures binnen [p_start, p_end) samenvatten met dezelfde helpers
  // als de server (computePlayer/TeamStandings). MATCH_Q2 valt in Q2 (Carol &
  // Dave), MATCH_DONE in Q3 (Alice & Bob).
  const teamsRec = Object.fromEntries(
    TEAMS.map((t) => [t.id, t]),
  ) as Record<string, Team>;
  const profilesRec = Object.fromEntries(
    PROFILES.map((p) => [p.id, p]),
  ) as Record<string, Profile>;
  const completed = [MATCH_Q2, MATCH_DONE] as unknown as Match[];
  const inWindow = (args: unknown) => {
    const { p_start, p_end } = args as { p_start: string; p_end: string };
    return completed.filter((m) => {
      const d = m.played_at ?? m.created_at;
      return d >= p_start && d < p_end;
    });
  };
  return {
    supabase: makeSupabaseMock({
      session: SESSION,
      tables: {
        ...TABLES,
        matches: [MATCH_Q2, MATCH_DONE, MATCH_PLANNED],
      },
      rpc: {
        // Bepaalt de kwartalen in de seizoenskiezer (Q2 → Q3 2026).
        first_match_date: "2026-05-10T10:00:00.000Z",
        season_player_standings: (args: unknown) =>
          computePlayerStandings(inWindow(args), teamsRec, profilesRec),
        season_team_standings: (args: unknown) =>
          computeTeamStandings(inWindow(args), teamsRec),
      },
    }),
  };
});

import Leaderboard from "./Leaderboard";

function renderPage(url = "/") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <ToastProvider>
          <Leaderboard />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

// De ToastProvider rendert zelf een role="status"-regio; de banner zoeken we
// daarom op zijn tekst (de kampioensnaam staat in een geneste <strong>).
const bannerText = /^kampioen /i;
const shareButton = () => screen.queryByRole("button", { name: /deel poster/i });

describe("<Leaderboard />", () => {
  it("toont de titel en een spelerrij (alle tijden als default)", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /klassement/i }),
    ).toBeInTheDocument();
    // Naam staat zowel in de desktop-tabel als in de mobiele ranglijst.
    expect((await screen.findAllByText(/alice anders/i)).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Seizoen")).toHaveValue("");
    // Geen seizoen gekozen → geen kampioensposter om te delen.
    expect(shareButton()).toBeNull();
    // Tier-badges (#127) bij de ratings: 1012 = Wannabe III, 988 = Blaaskaak I,
    // gedimd want alle fixtures hebben maar 1 match.
    const tiers = await screen.findAllByText("Wannabe III");
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers[0]).toHaveClass("is-dim");
    expect((await screen.findAllByText("Blaaskaak I")).length).toBeGreaterThan(0);
  });

  it("zet Kylian Mbappé als waarnemend dictator op de troon zonder echte dictator (#530)", async () => {
    const { container } = renderPage();
    // Fixtures zitten rond 1000 rating — niemand haalt de dictator-tier (1600+),
    // dus de troon blijft niet leeg maar wordt bij verstek bezet door Mbappé.
    await screen.findAllByText(/alice anders/i);
    const troon = container.querySelector(".dictator-throne");
    expect(troon).not.toBeNull();
    expect(troon).toHaveClass("dictator-throne--waarnemend");
    expect(screen.getByText("Kylian Mbappé")).toBeInTheDocument();
    expect(screen.getByText("Madrid-Dictator")).toBeInTheDocument();
    // Mbappé regeert in absentia: de echte #1 houdt gewoon z'n Big Daddy-kroon.
    expect(screen.getAllByText(/big daddy/i).length).toBeGreaterThan(0);
  });

  it("filtert de ranglijst op naam en toont een lege-staat bij geen match (#282)", async () => {
    renderPage();
    await screen.findAllByText(/carol claes/i);
    const zoek = screen.getByLabelText("Zoek een speler");

    fireEvent.change(zoek, { target: { value: "carol" } });
    // Carol blijft; niet-matchende spelers verdwijnen (ook uit het podium).
    expect(screen.getAllByText(/carol claes/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/alice anders/i)).toBeNull();

    // Onzin-zoekterm → lege-staat i.p.v. een verminkte lijst.
    fireEvent.change(zoek, { target: { value: "zzzzz" } });
    expect(
      screen.getByText(/geen speler in de ranglijst gevonden/i),
    ).toBeInTheDocument();

    // De wis-knop herstelt de volledige ranglijst.
    fireEvent.click(screen.getByRole("button", { name: /zoekterm wissen/i }));
    expect((await screen.findAllByText(/alice anders/i)).length).toBeGreaterThan(0);
  });

  it("groepeert spelers per divisie op de Divisies-tab met legenda en promotie-hint", async () => {
    renderPage();
    await screen.findAllByText("Wannabe III");
    fireEvent.click(screen.getByRole("button", { name: /^divisies$/i }));

    // Sectiekop per hoofd-divisie: fixtures 1012 = Wannabe, 988 = Blaaskaak.
    expect(await screen.findByRole("heading", { name: /wannabe/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /blaaskaak/i })).toBeInTheDocument();
    // Legenda met de ludieke bijnaam en de instapdrempel.
    expect(screen.getByText(/wat betekenen de divisies/i)).toBeInTheDocument();
    expect(screen.getAllByText(/racket van €350/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/vanaf 1100/i).length).toBeGreaterThan(0);
    // Persoonlijke promotie-hint: jouw divisie + rating tot de volgende.
    expect(screen.getByText(/^jij:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/glazenwasser/i).length).toBeGreaterThan(0);
  });

  it("wisselt via de seizoenskiezer en toont de kampioensbanner van Q2", async () => {
    renderPage();
    // Wachten tot de kwartalen geladen zijn (afgeleid van de eerste match).
    await screen.findByRole("option", { name: "Q2 2026" });
    fireEvent.change(screen.getByLabelText("Seizoen"), {
      target: { value: "2026-q2" },
    });

    // Q2 is afgesloten: banner met de nummer 1 van dat kwartaal.
    const banner = await screen.findByText(bannerText);
    expect(banner).toHaveTextContent("Kampioen Q2 2026: Carol Claes");
    // De kwartaalstand telt alleen de Q2-match: Carol & Dave wonnen die.
    expect((await screen.findAllByText(/carol claes/i)).length).toBeGreaterThan(0);
    // Bij een afgesloten seizoen kan de poster gedeeld worden.
    expect(shareButton()).toBeInTheDocument();
  });

  it("toont geen banner en geen deelknop voor het lopende kwartaal", async () => {
    renderPage("/?seizoen=2026-q3");
    expect(screen.getByLabelText("Seizoen")).toHaveValue("2026-q3");
    expect((await screen.findAllByText(/alice anders/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(bannerText)).toBeNull();
    expect(shareButton()).toBeNull();
  });

  it("meldt een seizoen zonder matches en toont dan geen kampioen", async () => {
    renderPage("/?seizoen=2026-q1");
    expect(
      await screen.findByText("Geen matches in dit seizoen."),
    ).toBeInTheDocument();
    expect(screen.queryByText(bannerText)).toBeNull();
  });

  it("valt bij een ongeldige seizoenswaarde terug op alle tijden", async () => {
    renderPage("/?seizoen=onzin");
    expect((await screen.findAllByText(/alice anders/i)).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Seizoen")).toHaveValue("");
    expect(screen.queryByText(bannerText)).toBeNull();
  });

  it("deelt de poster via het klembord en meldt dat met een toast", async () => {
    // jsdom heeft geen canvas of klembord: net genoeg stubben om de
    // klembord-terugval van sharePng te doorlopen.
    const fakeCtx = {
      fillStyle: "",
      font: "",
      textAlign: "",
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: () => ({ width: 100 }),
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
    };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((cb) => cb(new Blob(["png"], { type: "image/png" })));
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { write },
      configurable: true,
    });
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(public items: Record<string, Blob>) {}
      },
    );

    try {
      renderPage("/?seizoen=2026-q2");
      fireEvent.click(await screen.findByRole("button", { name: /deel poster/i }));
      expect(
        await screen.findByText("Poster gekopieerd naar klembord."),
      ).toBeInTheDocument();
      expect(write).toHaveBeenCalledTimes(1);
    } finally {
      getContext.mockRestore();
      toBlob.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("toont een sparkline met het ratingverloop van de speler", async () => {
    renderPage();
    expect(
      await screen.findByRole("img", {
        name: "Ratingverloop van Alice Anders",
      }),
    ).toBeInTheDocument();
  });

  it("toont rating als hoofdgetal in de mobiele ranglijst, punten als label", async () => {
    const { container } = renderPage();
    await screen.findAllByText(/alice anders/i);
    // Bovenaan staan p1/p2 (rating 1012, 3 ptn); rating is het grote getal.
    const lead = container.querySelector(".ranklist__lead");
    const label = container.querySelector(".ranklist__lead-label");
    expect(lead).toHaveTextContent("1012");
    expect(label).toHaveTextContent("3 ptn");
  });

  it("becommentarieert jouw positie bij 'Alle groepen' (#411)", async () => {
    // p1 (ingelogd) heeft 1 match < THIN_GAMES → tier "nieuw"; de regel komt
    // dan deterministisch uit de NIEUW-pool.
    const { container } = renderPage();
    await screen.findAllByText("Wannabe III");
    fireEvent.click(screen.getByRole("button", { name: /^divisies$/i }));

    const tekst = container.querySelector(".klassement-coach .coach-sneer__text");
    expect(tekst).not.toBeNull();
    expect(NIEUW as readonly string[]).toContain(tekst?.textContent);
  });

  it("blijft spreken wanneer een groep gekozen is (#411)", async () => {
    const { container } = renderPage();
    await screen.findAllByText("Wannabe III");
    fireEvent.click(screen.getByRole("button", { name: /^divisies$/i }));
    fireEvent.change(screen.getByLabelText("Groep"), { target: { value: "g1" } });

    await screen.findAllByText(/alice anders/i);
    const tekst = container.querySelector(".klassement-coach .coach-sneer__text");
    expect(tekst).not.toBeNull();
    expect(NIEUW as readonly string[]).toContain(tekst?.textContent);
  });

  it("toont op de spelers-tab de troon-propaganda én Rudy's positie-bubbel (#411 + #530)", async () => {
    // Met De Troon (#530) staan er twee kijker-gerichte Rudy-regels: de
    // propaganda op de troon en de generieke positie-bubbel over jou. Beide
    // spreken de kijker aan — geen derde-persoons "over de #1"-bubbel (#411).
    const { container } = renderPage();
    await screen.findAllByText(/alice anders/i);
    const teksten = Array.from(
      container.querySelectorAll(".klassement-coach .coach-sneer__text"),
    ).map((e) => e.textContent);
    expect(teksten).toHaveLength(2);
    // Eén ervan is jouw positie-commentaar uit de NIEUW-pool.
    expect(
      teksten.some((t) => (NIEUW as readonly string[]).includes(t ?? "")),
    ).toBe(true);
  });

  it("zwijgt over je positie in een seizoensarchief (#411)", async () => {
    const { container } = renderPage("/?seizoen=2026-q2");
    await screen.findAllByText(/carol claes/i);
    fireEvent.click(screen.getByRole("button", { name: /^divisies$/i }));
    expect(container.querySelector(".klassement-coach")).toBeNull();
  });

  it("zet Rating als laatste kolom bij spelers, Punten bij teams", async () => {
    renderPage();
    await screen.findAllByText(/alice anders/i);
    const playerHeaders = screen.getAllByRole("columnheader");
    expect(playerHeaders[playerHeaders.length - 1]).toHaveTextContent(/rating/i);
    expect(
      screen.getByText("Wie is de koning en wie is het slofje? Puur gesorteerd op rating."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Teams" }));
    expect(await screen.findByText("Vaste duo's gesorteerd op pure puntenheerschappij.")).toBeInTheDocument();
    const teamHeaders = await screen.findAllByRole("columnheader");
    expect(teamHeaders[teamHeaders.length - 1]).toHaveTextContent(/punten/i);
  });
});
