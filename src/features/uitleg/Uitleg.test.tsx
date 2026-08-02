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

/** De secties die vandaag gevuld zijn; groeit mee met de pagina. */
const ZICHTBAAR = [
  { id: "tiers", titel: "Tiers & divisies" },
  { id: "kaarten", titel: "Spelerskaarten" },
  { id: "rudy", titel: "Coach Rudy" },
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
