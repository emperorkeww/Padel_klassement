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

// De hub leeft op /spelen; /groepen is in de app een redirect hierheen. Sinds
// #916 stuurt de hub niemand meer door, dus de entry doet er alleen nog toe
// voor tests die expliciet een andere URL willen.
function renderPage(entry = "/spelen") {
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
    expect(screen.queryByLabelText(/groepsnaam/i)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /nieuwe groep/i }),
    );
    const veld = await screen.findByLabelText(/groepsnaam/i);
    expect(veld).toHaveFocus();
  });

  it("zet het aanmaakformulier meteen open als je nog geen groep hebt", async () => {
    tables.groups = [];
    renderPage();
    expect(
      await screen.findByText(/geen groep, geen glorie/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/groepsnaam/i)).toBeInTheDocument();
  });

  it("maakt een groep aan en gaat door naar de ledentab", async () => {
    renderPage();
    await screen.findByRole("link", { name: /vrijdagavond padel/i });
    await userEvent.click(
      screen.getByRole("button", { name: /nieuwe groep/i }),
    );
    await userEvent.type(
      await screen.findByLabelText(/groepsnaam/i),
      "Zondagochtend",
    );
    await userEvent.click(screen.getByRole("button", { name: /aanmaken/i }));
    expect(supabase.from).toHaveBeenCalledWith("groups");
    expect(await screen.findByText(/groep aangemaakt/i)).toBeInTheDocument();
    // Na aanmaken navigeren we naar de detailpagina van de nieuwe groep.
    expect(await screen.findByText(/detailpagina/i)).toBeInTheDocument();
  });

  // #674 A5 zette losse match en vrije banen in een secundaire rij ónder de
  // groepen. #916 haalt "losse match" daar weer uit: het is een veelgebruikt
  // pad, geen restcategorie. De groepen blijven wél bovenaan.
  it("zet losse match onder de groepen, maar als gewone actie", async () => {
    const { container } = renderPage();
    const kaart = await screen.findByRole("link", {
      name: /vrijdagavond padel/i,
    });
    const los = container.querySelector(".hub-los")!;
    expect(
      kaart.compareDocumentPosition(los) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(los as HTMLElement).getByText(/^losse match$/i)).toBeInTheDocument();
    expect(
      within(los as HTMLElement).getByRole("link", { name: /match loggen/i }),
    ).toHaveClass("btn--primary");
    // Vrije banen blijft een rustige verwijzing, geen kaart.
    expect(
      screen.getByRole("link", { name: /bekijk de banen/i }),
    ).toHaveAttribute("href", "/banen");
  });

  // #674 maakte van "één groep" een doorstuur naar die groep; #761 moest daar
  // een ?hub=1-uitzondering voor bouwen omdat "+ Nieuwe groep" anders alleen
  // via een knop diep in de groepskop te vinden was. Sinds #916 staat de hub
  // er gewoon altijd.
  it("blijft op de hub staan met één groep, inclusief nieuwe groep", async () => {
    renderPage("/spelen");
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

  // ── #916 ────────────────────────────────────────────────────────────────

  it("houdt de plek van het statuslabel vrij tijdens het laden", async () => {
    // De journey komt uit een tweede query en viel ná de kaarten binnen,
    // waardoor de lijst versprong.
    const { container } = renderPage();
    await screen.findByRole("link", { name: /vrijdagavond padel/i });
    expect(
      container.querySelector(".group-card__journey"),
    ).not.toBeNull();

    // En daarna staat op diezelfde plek het echte label.
    expect(
      await screen.findByText(/poll loopt — stem mee/i),
    ).toHaveClass("group-card__journey");
  });

  it("laat het aanmaakformulier weer sluiten", async () => {
    renderPage();
    await screen.findByRole("link", { name: /vrijdagavond padel/i });

    const openen = screen.getByRole("button", { name: /nieuwe groep/i });
    await userEvent.click(openen);
    await screen.findByLabelText(/groepsnaam/i);

    // #916: uitklappen had geen tegenhanger.
    await userEvent.click(
      screen.getByRole("button", { name: /formulier sluiten/i }),
    );
    expect(screen.queryByLabelText(/groepsnaam/i)).not.toBeInTheDocument();
    // Focus komt terug op de knop waar je vandaan kwam.
    expect(screen.getByRole("button", { name: /nieuwe groep/i })).toHaveFocus();
  });

  it("geeft de lege staat één knop die de groep echt aanmaakt", async () => {
    tables.groups = [];
    renderPage();
    await screen.findByText(/geen groep, geen glorie/i);

    // Eerder stond hier een knop "Maak een groep" die alleen het veld focuste,
    // met datzelfde formulier al open eronder.
    expect(screen.queryByRole("button", { name: /^maak een groep$/i })).toBeNull();
    const knop = screen.getByRole("button", { name: /maak deze groep/i });
    expect(knop).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText(/groepsnaam/i),
      "Zondagochtend",
    );
    await userEvent.click(screen.getByRole("button", { name: /maak deze groep/i }));
    expect(supabase.from).toHaveBeenCalledWith("groups");
  });
});
