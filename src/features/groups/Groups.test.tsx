import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

const tables = vi.hoisted(() => ({}) as Record<string, unknown[]>);

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import Groups from "./Groups";
import { supabase } from "@/lib/supabase/client";
import { TABLES } from "@/test/fixtures";

// De hub leeft op /spelen; /groepen is in de app een redirect hierheen. De
// doorstuur-naar-je-enige-groep (#674) kijkt naar het pad, dus de entry bepaalt
// of die afgaat — vandaar dat hij instelbaar is (#761).
function renderPage(entry = "/spelen?hub=1") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/spelen" element={<Groups />} />
            <Route path="/groepen/:id" element={<div>detailpagina</div>} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<Groups />", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(TABLES)) tables[k] = [...v];
  });

  it("toont de groep als klikbare kaart met eigenaar-badge en ledenaantal", async () => {
    renderPage();
    const kaart = await screen.findByRole("link", { name: /vrijdagavond padel/i });
    // De href krijgt er asynchroon "?tab=plannen" bij zodra de open poll
    // (fixtures) geladen is — alleen het pad is hier van belang, anders
    // flaket de test op die race.
    expect(kaart.getAttribute("href")).toMatch(/^\/groepen\/g1(\?|$)/);
    expect(screen.getByText(/eigenaar/i)).toBeInTheDocument();
    expect(screen.getByText(/4 leden/i)).toBeInTheDocument();
  });

  // #674 A5: het aanmaakformulier stond altijd open en woog even zwaar als de
  // groepen zelf. Nu zit het achter een knop — maar met nul groepen is dít de
  // actie van de pagina, dus dan staat het meteen open.
  it("verbergt het aanmaakformulier achter een knop zodra je een groep hebt", async () => {
    renderPage();
    await screen.findByRole("link", { name: /vrijdagavond padel/i });
    expect(screen.queryByPlaceholderText(/groepsnaam/i)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /nieuwe groep/i }),
    );
    const veld = await screen.findByPlaceholderText(/groepsnaam/i);
    expect(veld).toHaveFocus();
  });

  it("zet het aanmaakformulier meteen open als je nog geen groep hebt", async () => {
    tables.groups = [];
    renderPage();
    expect(
      await screen.findByText(/geen groep, geen glorie/i),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/groepsnaam/i)).toBeInTheDocument();
  });

  it("maakt een groep aan en gaat door naar de ledentab", async () => {
    renderPage();
    await screen.findByRole("link", { name: /vrijdagavond padel/i });
    await userEvent.click(
      screen.getByRole("button", { name: /nieuwe groep/i }),
    );
    await userEvent.type(
      await screen.findByPlaceholderText(/groepsnaam/i),
      "Zondagochtend",
    );
    await userEvent.click(screen.getByRole("button", { name: /aanmaken/i }));
    expect(supabase.from).toHaveBeenCalledWith("groups");
    expect(await screen.findByText(/groep aangemaakt/i)).toBeInTheDocument();
    // Na aanmaken navigeren we naar de detailpagina van de nieuwe groep.
    expect(await screen.findByText(/detailpagina/i)).toBeInTheDocument();
  });

  // #674 A5: losse match en vrije banen stonden als volwaardige kaarten tussen
  // de groepen; ze horen in een secundaire rij ónder de groepen.
  it("zet losse match en vrije banen in een secundaire rij onder de groepen", async () => {
    renderPage();
    const kaart = await screen.findByRole("link", {
      name: /vrijdagavond padel/i,
    });
    const rij = screen.getByRole("region", { name: /ook hier/i });
    expect(
      kaart.compareDocumentPosition(rij) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(rij).getByText(/^losse match$/i)).toBeInTheDocument();
    expect(within(rij).getByText(/^vrije banen$/i)).toBeInTheDocument();
    // "Match loggen" is niet langer de primaire knop van de pagina.
    expect(
      within(rij).getByRole("link", { name: /match loggen/i }),
    ).not.toHaveClass("btn--primary");
  });

  // #674: met precies één groep is die groep je Spelen-tab.
  it("stuurt kaal /spelen met één groep door naar die groep", async () => {
    renderPage("/spelen");
    expect(await screen.findByText(/detailpagina/i)).toBeInTheDocument();
  });

  // #761: die doorstuur maakte de hub onbereikbaar — en daarmee de enige plek
  // met "+ Nieuwe groep". Met ?hub=1 (de knop in de groepskop, en waar /groepen
  // heen redirect) blijft de hub staan, ook met één groep.
  it("laat de hub staan op ?hub=1, inclusief nieuwe groep", async () => {
    renderPage("/spelen?hub=1");
    expect(
      await screen.findByRole("link", { name: /vrijdagavond padel/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /nieuwe groep/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/detailpagina/i)).not.toBeInTheDocument();
  });

  // #674 B6: "actie nodig" verschilde alleen in tekstkleur van "staat vast".
  it("geeft een groep die op je stem wacht een eigen accent", async () => {
    renderPage();
    // De fixture-poll staat open → er wordt een stem gevraagd.
    const badge = await screen.findByText(/poll loopt — stem mee/i);
    expect(badge).toHaveClass("group-card__journey--act");
    // Het icoon staat los van de tekst, zodat de screenreader "Poll loopt"
    // hoort en niet de naam van de emoji.
    expect(badge.textContent).toContain("📊");
    expect(
      within(badge).getByText("📊", { selector: "[aria-hidden='true']" }),
    ).toBeInTheDocument();
  });
});
