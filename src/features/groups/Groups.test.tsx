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

// De matchsectie heeft zijn eigen suite (MatchesSectie.test.tsx); hier is
// alleen interessant *dat* hij eronder staat en welke groep hij meekrijgt.
vi.mock("@/features/matches/MatchesSectie", () => ({
  MatchesSectie: ({ groepId }: { groepId: string }) => (
    <div data-testid="matchsectie">groep:{groepId || "alle"}</div>
  ),
}));

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

  // #1123: de groepen zijn een keuzestrook geworden. Kiezen scoopt de
  // matchlijst eronder; de weg naar de groepspagina staat in de regel eronder.
  it("toont de groepen als chips en scoopt de matches op je keuze", async () => {
    renderPage();
    const chip = await screen.findByRole("button", {
      name: /vrijdagavond padel/i,
    });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    // "Alle" is de standaard: geen groep in de URL, alles in de lijst.
    expect(screen.getByRole("button", { name: /^alle$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("matchsectie")).toHaveTextContent("groep:alle");

    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("matchsectie")).toHaveTextContent("groep:g1");

    // De regel onder de strook draagt wat niet in een chip past.
    expect(screen.getByText(/eigenaar/i)).toBeInTheDocument();
    expect(screen.getByText(/4 leden/i)).toBeInTheDocument();
    const open = screen.getByRole("link", { name: /open groep/i });
    expect(open).toHaveAttribute("href", "/groepen/g1");
  });

  // #674 A5: het aanmaakformulier stond altijd open en woog even zwaar als de
  // groepen zelf. Nu zit het achter een knop — maar met nul groepen is dít de
  // actie van de pagina, dus dan staat het meteen open.
  it("verbergt het aanmaakformulier achter een knop zodra je een groep hebt", async () => {
    renderPage();
    await screen.findByRole("button", { name: /vrijdagavond padel/i });
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
    await screen.findByRole("button", { name: /vrijdagavond padel/i });
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
  // groepen; #916 haalde "losse match" daar weer uit. Sinds #1123 is die kaart
  // helemaal overbodig: de matches staan hier zelf, met de logknop erbij.
  it("zet de matches onder de groepskeuze", async () => {
    const { container } = renderPage();
    const strook = await screen.findByRole("group", { name: /groep kiezen/i });
    const sectie = screen.getByTestId("matchsectie");
    expect(
      strook.compareDocumentPosition(sectie) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // De losse-matchkaart is weg; loggen loopt via de knop in de sectie.
    expect(container.querySelector(".hub-los")).toBeNull();
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
      await screen.findByRole("button", { name: /vrijdagavond padel/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /nieuwe groep/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/detailpagina/i)).not.toBeInTheDocument();
  });

  // #674 B6 gaf een groep die op je stem wacht een eigen accent op de kaart.
  // De kaarten zijn weg (#1123); de reisstatus staat nu voluit in de regel
  // onder de strook, zodra je die groep kiest. De statusstip ín de chip volgt
  // in een aparte stap.
  it("toont de reisstatus van de gekozen groep", async () => {
    const { container } = renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /vrijdagavond padel/i }),
    );
    // De fixture-poll staat open → er wordt een stem gevraagd. Het label staat
    // zichtbaar in de regel onder de strook; in de chip zelf staat dezelfde
    // status alleen voor de screenreader (#1123), vandaar de scope.
    const regel = await screen.findByText(/4 leden/i).then((el) => el.closest(".groep-regel")!);
    expect(within(regel as HTMLElement).getByText(/poll loopt — stem mee/i)).toBeInTheDocument();
    // En in de chip hoor je hem, zonder hem twee keer te zien.
    expect(
      container.querySelectorAll(".groep-strook .sr-only"),
    ).toHaveLength(1);
  });

  it("laat het aanmaakformulier weer sluiten", async () => {
    renderPage();
    await screen.findByRole("button", { name: /vrijdagavond padel/i });

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
