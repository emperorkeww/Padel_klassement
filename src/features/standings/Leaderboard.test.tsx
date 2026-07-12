import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { makeSupabaseMock } from "../../test/supabaseMock";
import { TABLES, SESSION, MATCH_DONE, MATCH_PLANNED } from "../../test/fixtures";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

// Vast "nu" (3 juli 2026, Q3): zo is Q2 2026 een afgesloten seizoen met een
// kampioen. Alleen Date wordt gefaket, zodat waitFor/findBy gewoon blijven werken.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 6, 3, 12) });
});
afterAll(() => {
  vi.useRealTimers();
});

vi.mock("../../lib/supabase", () => {
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
  return {
    supabase: makeSupabaseMock({
      session: SESSION,
      tables: {
        ...TABLES,
        // De Q2-match eerst: de mock negeert order(), dus rij 0 bepaalt de
        // "eerste match" en daarmee de kwartalen in de seizoenskiezer.
        matches: [MATCH_Q2, MATCH_DONE, MATCH_PLANNED],
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
