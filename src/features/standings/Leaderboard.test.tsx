import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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

import * as profilesApi from "@/features/profiles/api";
import Leaderboard from "./Leaderboard";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "@/test/supabaseMock";
import { invalidateAll } from "@/lib/supabase/queryCache";

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

// Sinds #913 is het filtermenu een echte disclosure: het paneel bestaat alleen
// terwijl het open staat, dus de velden zijn er pas na een tik op de knop.
// (Het menu sluit ook na elke keuze, vandaar telkens opnieuw openen.)
const openFilters = () =>
  fireEvent.click(screen.getByRole("button", { name: /filteren/i }));

/** Dwingt de gemeten containerbreedte af, zodat de tabel⇄ranglijst-keuze in
 *  jsdom te sturen is; zonder layout meet de hook niets en valt hij terug op
 *  de tabel. Geeft een herstelfunctie terug. */
function metContainerBreedte(px: number) {
  const origRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    return { ...origRect.call(this), width: px } as DOMRect;
  };
  return () => {
    Element.prototype.getBoundingClientRect = origRect;
  };
}

describe("<Leaderboard />", () => {
  it("opent de Race View via de URL en schakelt terug naar de bestaande tabel", async () => {
    const { container } = renderPage("/?view=race");
    await screen.findAllByText(/alice anders/i);
    expect(screen.getByRole("tab", { name: /^race$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(container.querySelector(".race-board")).not.toBeNull();
    expect(container.querySelector(".leaderboard-table")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /^tabel$/i }));
    expect(container.querySelector(".race-board")).toBeNull();
    expect(container.querySelector(".leaderboard-table")).not.toBeNull();
  });

  it("toont de titel en een spelerrij (alle tijden als default)", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /klassement/i }),
    ).toBeInTheDocument();
    // Naam staat zowel in de desktop-tabel als in de mobiele ranglijst.
    expect((await screen.findAllByText(/alice anders/i)).length).toBeGreaterThan(0);
    openFilters();
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

  it("verbergt de waarnemend Mbappé-troon wanneer de flag uit staat (#536)", async () => {
    vi.stubEnv("VITE_DEFAULT_DICTATOR", "false");
    try {
      const { container } = renderPage();
      await screen.findAllByText(/alice anders/i);
      // Geen troon bij verstek en geen Mbappé; val terug op het #528-podium.
      expect(container.querySelector(".dictator-throne")).toBeNull();
      expect(screen.queryByText("Kylian Mbappé")).toBeNull();
      // Het Big Daddy-podium blijft gewoon staan.
      expect(screen.getAllByText(/big daddy/i).length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("verbergt de waarnemend Mbappé wanneer de gebruiker 'm in z'n profiel uitzet (#542)", async () => {
    // Voorkeur uit in het eigen profiel → geen troon bij verstek, ook al staat
    // de globale flag aan. Het Big Daddy-podium (#528) blijft.
    const spy = vi.spyOn(profilesApi, "getProfilesMap").mockResolvedValue({
      p1: {
        id: "p1",
        username: "alice",
        full_name: "Alice Anders",
        avatar_url: null,
        created_at: "2026-01-01T00:00:00.000Z",
        toon_waarnemend_dictator: false,
      },
    });
    try {
      const { container } = renderPage();
      await screen.findAllByText(/alice anders/i);
      expect(container.querySelector(".dictator-throne")).toBeNull();
      expect(screen.queryByText("Kylian Mbappé")).toBeNull();
      expect(screen.getAllByText(/big daddy/i).length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
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

  // #924: zoeken snoeide de lijst geluidloos — de uitkomst hoorde je nergens.
  it("kondigt aan hoeveel spelers er na het zoeken overblijven", async () => {
    renderPage();
    await screen.findAllByText(/carol claes/i);

    fireEvent.change(screen.getByLabelText("Zoek een speler"), {
      target: { value: "carol" },
    });
    expect(await screen.findByText(/1 speler in de lijst\./)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Zoek een speler"), {
      target: { value: "zzzzz" },
    });
    expect(
      await screen.findByText(/geen spelers in de lijst\./i),
    ).toBeInTheDocument();
  });

  it("groepeert spelers per divisie op de Divisies-tab met legenda en promotie-hint", async () => {
    renderPage();
    await screen.findAllByText("Wannabe III");
    fireEvent.click(screen.getByRole("tab", { name: /^divisies$/i }));

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

  // #1215: Divisies stond als vierde tab naast Spelers, terwijl Tabel en Race
  // — óók presentaties van dezelfde lijst — een niveau lager zaten.
  it("zet Divisies bij de weergaven en niet bij de tabs", async () => {
    renderPage();
    await screen.findAllByText("Wannabe III");

    const tabs = screen.getByRole("tablist", { name: "Klassement-weergave" });
    expect(
      within(tabs).queryByRole("tab", { name: /^divisies$/i }),
    ).not.toBeInTheDocument();

    const weergaven = screen.getByRole("tablist", {
      name: /spelersklassement-weergave/i,
    });
    for (const naam of [/^tabel$/i, /^race$/i, /^divisies$/i]) {
      expect(within(weergaven).getByRole("tab", { name: naam })).toBeInTheDocument();
    }
  });

  it("opent de divisieweergave uit een gedeelde link", async () => {
    // Deelbaar en refresh-bestendig, net als ?view=race (#913).
    renderPage("/?view=divisies");
    expect(
      await screen.findByRole("heading", { name: /wannabe/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /^divisies$/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("wisselt via de seizoenskiezer en toont de kampioensbanner van Q2", async () => {
    renderPage();
    // Wachten tot de kwartalen geladen zijn (afgeleid van de eerste match).
    openFilters();
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
    openFilters();
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
    openFilters();
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
    // Smalle kaart → compacte ranglijst i.p.v. de tabel (#913).
    const herstel = metContainerBreedte(400);
    try {
      const { container } = renderPage();
      await screen.findAllByText(/alice anders/i);
      // De meting zit in een effect dat pas loopt als de lijstcontainer
      // gemonteerd is — dus ná de eerste rij met een naam. Wacht tot de
      // omschakeling er echt is; de stub moet zolang blijven staan, anders
      // meet dat effect de jsdom-breedte 0 en valt de tabel terug.
      await waitFor(() =>
        expect(container.querySelector(".ranklist__lead")).not.toBeNull(),
      );
      // Bovenaan staan p1/p2 (rating 1012, 3 ptn); rating is het grote getal.
      const lead = container.querySelector(".ranklist__lead");
      const label = container.querySelector(".ranklist__lead-label");
      expect(lead).toHaveTextContent("1012");
      expect(label).toHaveTextContent("3 ptn");
    } finally {
      herstel();
    }
  });

  it("becommentarieert jouw positie bij 'Alle groepen' (#411)", async () => {
    // p1 (ingelogd) heeft 1 match < THIN_GAMES → tier "nieuw"; de regel komt
    // dan deterministisch uit de NIEUW-pool.
    const { container } = renderPage();
    await screen.findAllByText("Wannabe III");
    fireEvent.click(screen.getByRole("tab", { name: /^divisies$/i }));

    const tekst = container.querySelector(".klassement-coach .coach-sneer__text");
    expect(tekst).not.toBeNull();
    expect(NIEUW as readonly string[]).toContain(tekst?.textContent);
  });

  it("blijft spreken wanneer een groep gekozen is (#411)", async () => {
    const { container } = renderPage();
    await screen.findAllByText("Wannabe III");
    fireEvent.click(screen.getByRole("tab", { name: /^divisies$/i }));
    openFilters();
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
    fireEvent.click(screen.getByRole("tab", { name: /^divisies$/i }));
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

    fireEvent.click(screen.getByRole("tab", { name: "Teams" }));
    expect(await screen.findByText("Vaste duo's gesorteerd op pure puntenheerschappij.")).toBeInTheDocument();
    const teamHeaders = await screen.findAllByRole("columnheader");
    expect(teamHeaders[teamHeaders.length - 1]).toHaveTextContent(/punten/i);
  });
});

describe("Kaarten-tab en kaart-preview (#497)", () => {
  it("toont op de Kaarten-tab de kaartenwand met rang-munten en de Big Daddy als Icon", async () => {
    const { container } = renderPage();
    await screen.findAllByText(/alice anders/i);
    fireEvent.click(screen.getByRole("tab", { name: /kaarten/i }));
    // Alle spelers als kaart, met een rang-munt; de #1 draagt goud.
    expect(
      container.querySelectorAll(".kaart-raster .fut-kaart").length,
    ).toBeGreaterThanOrEqual(2);
    expect(container.querySelector(".kaart-raster__rang--1")).not.toBeNull();
    // Mbappé regeert slechts in absentia (#530), dus de echte #1 blijft Big
    // Daddy — en die krijgt de Icon-editie op zijn kaart.
    expect(container.querySelector(".fut-kaart--icon")).not.toBeNull();
    expect(
      container.querySelector(".fut-kaart--icon .fut-kaart__editie"),
    ).toHaveTextContent(/big daddy/i);
  });

  // #763: de wand toonde frames, schilden en editie-regels zonder ergens uit
  // te leggen wat ze betekenen. De kaarten in het paneel worden pas gerenderd
  // als het openstaat — zeventien kaarten hoeven niet te bestaan zolang
  // niemand kijkt.
  it("legt de kaarten uit in een uitklapper op de Kaarten-tab", async () => {
    const { container } = renderPage();
    await screen.findAllByText(/alice anders/i);
    fireEvent.click(screen.getByRole("tab", { name: /kaarten/i }));

    const legenda = container.querySelector(".kaart-legenda") as HTMLElement;
    expect(legenda).not.toBeNull();
    expect(legenda.querySelector(".kaart-legenda__raster")).toBeNull();

    fireEvent.click(screen.getByText(/wat betekenen de kaarten/i));
    await screen.findByText(/^divisies$/i);

    // Elke speciale editie staat er als échte kaart, met zijn eigen skin.
    for (const editie of ["icon", "kampioen", "inform", "onfire", "pias", "piet"]) {
      expect(
        legenda.querySelector(`.fut-kaart--${editie}`),
        editie,
      ).not.toBeNull();
    }
    // De regel óp de kaart komt uit editieLabel met voorbeeldwaarden, dus
    // exact de vorm die een echte drager te zien krijgt; het kopje eronder
    // draagt de kale editienaam.
    expect(within(legenda).getByText("🔥 On Fire · 6 op rij")).toBeInTheDocument();
    expect(within(legenda).getByText("🔥 On Fire")).toBeInTheDocument();
    // En elke divisie, inclusief de toptiers die geen editie zijn.
    expect(within(legenda).getByText("🐐 GOAT")).toBeInTheDocument();
    expect(within(legenda).getByText(/Rating 1600\+/)).toBeInTheDocument();
    // Naamplaat van de voorbeeldkaarten: de kijker zelf.
    expect(
      within(legenda).getAllByText(/alice anders/i).length,
    ).toBeGreaterThan(1);
  });

  it("houdt de kaartuitleg weg van de andere tabs", async () => {
    const { container } = renderPage();
    await screen.findAllByText(/alice anders/i);
    expect(container.querySelector(".kaart-legenda")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Divisies" }));
    expect(container.querySelector(".kaart-legenda")).toBeNull();
  });

  it("opent de kaart-preview vanaf een raster-kaart en sluit met Escape", async () => {
    renderPage();
    await screen.findAllByText(/alice anders/i);
    fireEvent.click(screen.getByRole("tab", { name: /kaarten/i }));
    fireEvent.click(
      screen.getAllByRole("button", { name: /fut-kaart van/i })[0],
    );
    const dialog = await screen.findByRole("dialog", {
      name: /fut-kaart van/i,
    });
    expect(dialog).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: /fut-kaart van/i }),
    ).toBeNull();
  });

  it("opent de preview via de avatar-knop op de spelersrij, met profiel-link", async () => {
    renderPage();
    await screen.findAllByText(/alice anders/i);
    fireEvent.click(
      screen.getAllByRole("button", { name: /fut-kaart van alice/i })[0],
    );
    const dialog = await screen.findByRole("dialog", {
      name: /fut-kaart van alice/i,
    });
    expect(
      within(dialog).getByRole("link", { name: /profiel/i }),
    ).toHaveAttribute("href", expect.stringContaining("/spelers/"));
  });

  // ── #913: filtermenu, filterchips en één lijstweergave ──────────────────

  describe("filters (#913)", () => {
    const filterKnop = () => screen.getByRole("button", { name: /filteren/i });

    it("sluit het menu bij Escape en geeft de focus terug aan de knop", async () => {
      renderPage();
      await screen.findAllByText(/alice anders/i);

      openFilters();
      expect(filterKnop()).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByLabelText("Seizoen")).toBeInTheDocument();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(filterKnop()).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByLabelText("Seizoen")).toBeNull();
      expect(filterKnop()).toHaveFocus();
    });

    it("sluit het menu bij een klik buiten", async () => {
      renderPage();
      await screen.findAllByText(/alice anders/i);

      openFilters();
      expect(screen.getByLabelText("Seizoen")).toBeInTheDocument();
      fireEvent.pointerDown(document.body);
      expect(screen.queryByLabelText("Seizoen")).toBeNull();
    });

    it("sluit het menu na een keuze", async () => {
      renderPage();
      await screen.findAllByText(/alice anders/i);

      openFilters();
      await screen.findByRole("option", { name: "Q2 2026" });
      fireEvent.change(screen.getByLabelText("Seizoen"), {
        target: { value: "2026-q2" },
      });
      expect(screen.queryByLabelText("Seizoen")).toBeNull();
      expect(filterKnop()).toHaveAttribute("aria-expanded", "false");
    });

    it("toont elk actief filter als chip die apart te wissen is", async () => {
      renderPage("/?seizoen=2026-q2");
      await screen.findAllByText(/carol claes/i);

      const chips = screen.getByRole("group", { name: /actieve filters/i });
      expect(chips).toHaveTextContent("Seizoen: Q2 2026");
      // Eén filter: nog geen "alles wissen".
      expect(screen.queryByRole("button", { name: /alles wissen/i })).toBeNull();

      fireEvent.click(
        screen.getByRole("button", { name: /seizoen: q2 2026 wissen/i }),
      );
      expect(screen.queryByRole("group", { name: /actieve filters/i })).toBeNull();
    });

    it("biedt 'alles wissen' vanaf twee filters", async () => {
      renderPage("/?seizoen=2026-q2&min=3");
      await screen.findByRole("group", { name: /actieve filters/i });

      expect(screen.getByRole("button", { name: /alles wissen/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /alles wissen/i }));
      expect(screen.queryByRole("group", { name: /actieve filters/i })).toBeNull();
    });

    it("legt uit waarom een uitsluitende keuze vervalt", async () => {
      renderPage("/?stand=2026-06-01");
      await screen.findAllByText(/alice anders/i);

      openFilters();
      await screen.findByRole("option", { name: "Q2 2026" });
      fireEvent.change(screen.getByLabelText("Seizoen"), {
        target: { value: "2026-q2" },
      });

      // Tot #913 verdween "stand op datum" hier zonder een woord.
      expect(
        screen.getByText(/gaat niet samen met een seizoen en is uitgezet/i),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /stand op .* wissen/i }),
      ).toBeNull();
    });
  });

  describe("één lijstweergave in de DOM (#913)", () => {
    it("toont bij een brede kaart de tabel en géén ranglijst", async () => {
      const herstel = metContainerBreedte(1200);
      try {
        const { container } = renderPage();
        await screen.findAllByText(/alice anders/i);
        expect(container.querySelector(".leaderboard-table")).not.toBeNull();
        expect(container.querySelector(".ranklist")).toBeNull();
      } finally {
        herstel();
      }
    });

    it("toont bij een smalle kaart de ranglijst en géén tabel", async () => {
      const herstel = metContainerBreedte(400);
      try {
        const { container } = renderPage();
        await screen.findAllByText(/alice anders/i);
        // Zolang useContainerBreedte nog niets gemeten heeft is switchBreedte
        // null, en dan toont Leaderboard bewust de tabel (zie de toelichting
        // bij `breedeLijst`). De omschakeling naar de ranglijst komt dus pas ná
        // een effect; direct asserteren is een race die er onder CI-load
        // uitkomt als "expected null not to be null". Zelfde wachtpatroon als
        // in "rating als hoofdgetal in de mobiele ranglijst" hierboven.
        await waitFor(() =>
          expect(container.querySelector(".ranklist")).not.toBeNull(),
        );
        expect(container.querySelector(".leaderboard-table")).toBeNull();
      } finally {
        herstel();
      }
    });
  });

  // #943: op 390px wrapte de meta-regel van een rij met veel matches (tier +
  // vormreeks + record), waardoor die rij hoger werd dan zijn buren en het
  // lijstritme brak. Het record valt daar weg; de rest blijft op één regel.
  it("houdt de lijstrijen op telefoonbreedte even hoog", () => {
    const css = readFileSync("src/features/standings/Leaderboard.css", "utf8");
    const smal = css.slice(css.indexOf("@media (max-width: 480px)"));
    expect(smal).toMatch(/\.ranklist__meta\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(smal).toMatch(/\.ranklist__record\s*\{\s*display:\s*none/);
  });

  // #913: de chip bestond alleen op de Spelers-tab, terwijl je jezelf op de
  // kaartenwand en tussen de divisies net zo goed kwijt bent.
  describe("'jouw positie' op elke spelersweergave (#913)", () => {
    /** Twaalf spelers (p1 = ingelogd) — boven de drempel van 8 rijen. */
    function metVolleRanglijst() {
      invalidateAll();
      const spelers = Array.from({ length: 12 }, (_, i) => ({
        player_id: i === 0 ? "p1" : `x${i}`,
        username: i === 0 ? "alice" : `speler${i}`,
        full_name: i === 0 ? "Alice Anders" : `Speler ${i}`,
        played: 5,
        won: 5 - i,
        drawn: 0,
        lost: i,
        points: (5 - i) * 3,
        goal_diff: 10 - i,
      }));
      const ratings = spelers.map((s, i) => ({
        player_id: s.player_id,
        rating: 1200 - i * 10,
        games: 5,
        updated_at: "2026-07-01T10:00:00.000Z",
      }));
      const fromMock = supabase.from as unknown as {
        getMockImplementation: () => (table: string) => unknown;
        mockImplementation: (impl: (table: string) => unknown) => void;
      };
      const orig = fromMock.getMockImplementation();
      fromMock.mockImplementation((t) =>
        t === "player_standings"
          ? makeQuery({ data: spelers, error: null })
          : t === "player_ratings"
            ? makeQuery({ data: ratings, error: null })
            : orig(t),
      );
      return () => {
        fromMock.mockImplementation(orig);
        invalidateAll();
      };
    }

    for (const [tabNaam, patroon] of [
      ["Spelers", /^spelers$/i],
      ["🃏 Kaarten", /kaarten/i],
      ["Divisies", /^divisies$/i],
    ] as const) {
      it(`toont de chip op de ${tabNaam}-tab`, async () => {
        const herstel = metVolleRanglijst();
        try {
          renderPage();
          await screen.findAllByText(/alice anders/i);
          fireEvent.click(screen.getByRole("tab", { name: patroon }));
          const chip = await screen.findByRole("button", {
            name: /jouw positie/i,
          });
          expect(chip).toBeInTheDocument();
          // Plaatsing én uitwijkgedrag komen van de gedeelde klasse (#942):
          // dezelfde die de zwevende logknop op Matches draagt. Anders lag de
          // chip tijdens het scrollen over de rating van de rij eronder.
          expect(chip).toHaveClass("zwevende-actie");
        } finally {
          herstel();
        }
      });
    }

    it("blijft weg op de Teams-tab — daar sta jij niet als speler", async () => {
      const herstel = metVolleRanglijst();
      try {
        renderPage();
        await screen.findAllByText(/alice anders/i);
        fireEvent.click(screen.getByRole("tab", { name: /^teams$/i }));
        expect(
          screen.queryByRole("button", { name: /jouw positie/i }),
        ).toBeNull();
      } finally {
        herstel();
      }
    });
  });
});
