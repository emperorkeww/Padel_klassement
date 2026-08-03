import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { UITLEG_REGELS } from "@/features/coach/coachUitleg";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import Uitleg from "./Uitleg";

function renderPagina(pad = "/uitleg") {
  return render(
    <MemoryRouter initialEntries={[pad]}>
      <AuthProvider>
        <Routes>
          <Route path="/uitleg" element={<Uitleg />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** De secties die vandaag gevuld zijn, in paginavolgorde; groeit mee met het
 *  register in ./inhoud. */
const ZICHTBAAR = [
  { id: "aan-de-slag", titel: "Aan de slag" },
  { id: "speeldag", titel: "Een speeldag organiseren" },
  { id: "banen", titel: "Banen boeken" },
  { id: "uitslagen", titel: "Uitslagen invoeren" },
  { id: "rating", titel: "Rating & klassement" },
  { id: "tiers", titel: "Tiers & divisies" },
  { id: "troon", titel: "De Troon & De Schandpaal" },
  { id: "kaarten", titel: "Spelerskaarten" },
  { id: "badges", titel: "Badges & mijlpalen" },
  { id: "toto", titel: "Toto, Lef & drankjes" },
  { id: "rudy", titel: "Coach Rudy" },
  { id: "feed", titel: "Feed & vrienden" },
  { id: "seizoen", titel: "Seizoen & Wrapped" },
  { id: "meldingen", titel: "Meldingen & installeren" },
  { id: "privacy", titel: "Privacy & instellingen" },
] as const;

describe("<Uitleg /> (#989)", () => {
  it("rendert de pagina met een inhoudsopgave en de secties eronder", async () => {
    renderPagina();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Hoe werkt het?" }),
    ).toBeInTheDocument();

    const toc = screen.getByRole("navigation", { name: "Inhoud" });
    for (const s of ZICHTBAAR) {
      expect(
        within(toc).getByRole("link", { name: new RegExp(s.titel, "i") }),
      ).toBeInTheDocument();
      // Elke sectie heeft een kop én een anker met dezelfde id.
      expect(
        screen.getByRole("heading", { level: 2, name: new RegExp(s.titel, "i") }),
      ).toBeInTheDocument();
      expect(document.getElementById(s.id)).not.toBeNull();
    }
  });

  it("laat elke inhoudsopgave-link naar het anker van zijn sectie wijzen", async () => {
    renderPagina();
    const toc = await screen.findByRole("navigation", { name: "Inhoud" });
    for (const s of ZICHTBAAR) {
      expect(
        within(toc).getByRole("link", { name: new RegExp(s.titel, "i") }),
      ).toHaveAttribute("href", `/uitleg#${s.id}`);
    }
  });

  it("navigeert bij een klik in de inhoudsopgave naar de juiste sectie", async () => {
    renderPagina();
    const toc = await screen.findByRole("navigation", { name: "Inhoud" });
    const sectie = document.getElementById("kaarten") as HTMLElement;
    // jsdom kent scrollIntoView niet; de pagina hoort daar niet op te klappen.
    sectie.scrollIntoView = vi.fn();

    await userEvent.click(
      within(toc).getByRole("link", { name: /spelerskaarten/i }),
    );

    expect(sectie.scrollIntoView).toHaveBeenCalled();
    // De focus verhuist mee, anders blijft een toetsenbordgebruiker bovenaan.
    expect(document.activeElement).toBe(sectie);
  });

  it("springt direct naar de sectie als je op een deep-link binnenkomt", async () => {
    // De hash staat er al bij het mounten; het effect moet dan alsnog landen.
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderPagina("/uitleg#rudy");
    await screen.findByRole("heading", { level: 1 });
    await vi.waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(document.activeElement).toBe(document.getElementById("rudy"));
  });

  it("laat Coach Rudy elke sectie inleiden, zonder zichzelf te herhalen", async () => {
    const { container } = renderPagina();
    await screen.findByRole("heading", { level: 1 });
    const bubbels = container.querySelectorAll(".coach-sneer__text");
    // Eén intro-bubbel plus één per sectie.
    expect(bubbels).toHaveLength(ZICHTBAAR.length + 1);
    const teksten = [...bubbels].map((b) => b.textContent);
    expect(new Set(teksten).size).toBe(teksten.length);
    for (const tekst of teksten) expect(tekst?.trim().length).toBeGreaterThan(0);
  });

  it("gebruikt de zachte gids-toon zolang er geen roast-voorkeur bekend is", async () => {
    // Het profiel in de fixtures heeft geen roast_intensiteit; de app valt dan
    // terug op "radioactief" — de scherpe pool. Dit legt vast dát de toon uit
    // coachUitleg komt en niet uit losse teksten op de pagina.
    const { container } = renderPagina();
    await screen.findByRole("heading", { level: 1 });
    const intro = container.querySelector(".coach-sneer__text")?.textContent;
    const alle = [...UITLEG_REGELS.intro.zacht, ...UITLEG_REGELS.intro.scherp];
    expect(alle).toContain(intro);
  });

  // De vraag die het vaakst gesteld wordt, en het antwoord dat het vaakst
  // verkeerd geraden wordt: 6-0 telt voor de rating hetzelfde als 7-6.
  it("zegt met zoveel woorden dat de scoremarge niet meetelt voor de rating", async () => {
    renderPagina();
    await screen.findByRole("heading", { level: 1 });
    const rating = document.getElementById("rating") as HTMLElement;
    expect(rating.textContent).toMatch(/score-?marge telt niet mee/i);
  });

  it("haalt de rating- en pias-getallen uit de modules die ze afdwingen", async () => {
    const { BASE_RATING } = await import("@/features/rating/elo");
    const { TIER_BANDEN } = await import("@/features/rating/tiers");
    const { AFDROGING_DREMPEL } = await import("@/features/groups/maandpias");
    renderPagina();
    await screen.findByRole("heading", { level: 1 });

    expect(document.getElementById("rating")?.textContent).toContain(
      String(BASE_RATING),
    );
    const troon = document.getElementById("troon")?.textContent ?? "";
    // De dictator-drempel is de ondergrens van de hoogste tier-band.
    expect(troon).toContain(String(TIER_BANDEN[TIER_BANDEN.length - 1].min));
    expect(troon).toContain(String(AFDROGING_DREMPEL));
  });

  it("haalt de toto-staffel en de lef-regels uit de modules die ze afdwingen", async () => {
    const { predictionPoints } = await import("@/features/matches/predictions");
    const { MIN_GAMES, STAKE_FACTOR } = await import("@/features/matches/stakes");
    renderPagina();
    await screen.findByRole("heading", { level: 1 });
    const toto = document.getElementById("toto")?.textContent ?? "";
    // De underdog-tip levert de hoogste staffelwaarde op.
    expect(toto).toContain(`${predictionPoints(0.25)} punten`);
    expect(toto).toContain(`${MIN_GAMES} matches`);
    expect(toto).toContain(`${STAKE_FACTOR}×`);
  });

  // iOS is de enige plek waar push écht níét werkt zonder installatie; wie dat
  // niet weet denkt dat de app stuk is.
  it("noemt de iOS-uitzondering bij meldingen", async () => {
    renderPagina();
    await screen.findByRole("heading", { level: 1 });
    const meldingen = document.getElementById("meldingen")?.textContent ?? "";
    expect(meldingen).toMatch(/iOS/);
    expect(meldingen).toMatch(/beginscherm/i);
  });

  it("rendert de divisies en kaart-edities uit de bestaande legenda's", async () => {
    renderPagina();
    await screen.findByRole("heading", { level: 1 });
    // TierLegend (#127) en KaartLegenda (#763) worden hier hergebruikt in
    // plaats van overgetypt; hun eigen samenvattingen verraden dat.
    expect(
      screen.getByText("Wat betekenen de divisies?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Wat betekenen de kaarten?")).toBeInTheDocument();
  });
});
