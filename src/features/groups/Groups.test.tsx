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
  MatchesSectie: ({
    groepId,
    groepen,
  }: {
    groepId: string;
    groepen?: { id: string; name: string }[];
  }) => (
    <div data-testid="matchsectie">
      groep:{groepId || "alle"} · keuze:
      {(groepen ?? []).map((g) => g.name).join("|") || "-"}
    </div>
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

  // #1134: de groepen zijn kaarten die naar de groep gaan — geen chips die de
  // lijst eronder filteren. Dat filteren doet het <select> in de matchsectie.
  it("toont de groepen als kaarten die naar de groepspagina gaan", async () => {
    renderPage();
    const kaart = await screen.findByRole("link", {
      name: /vrijdagavond padel/i,
    });
    expect(kaart).toHaveAttribute("href", "/groepen/g1");
    // Wat niet in een chip paste staat nu gewoon op de kaart.
    expect(within(kaart).getByText(/eigenaar/i)).toBeInTheDocument();
    expect(within(kaart).getByText(/4 leden/i)).toBeInTheDocument();
  });

  // Een kaart aantikken navigeert; hij mag de historie eronder niet stiekem
  // scopen. De scope komt uit de URL, en die schrijft alleen het filter.
  it("laat de matchsectie ongemoeid als je een kaart aantikt", async () => {
    renderPage();
    const kaart = await screen.findByRole("link", {
      name: /vrijdagavond padel/i,
    });
    expect(screen.getByTestId("matchsectie")).toHaveTextContent("groep:alle");

    await userEvent.click(kaart);
    expect(await screen.findByText(/detailpagina/i)).toBeInTheDocument();
  });

  // De groepsscope leeft in de URL en blijft daar werken, ook nu de kaarten hem
  // niet meer zetten: gedeelde links en /matches?groep=… lopen hierlangs.
  it("geeft ?groep= uit de URL door aan de matchsectie", async () => {
    renderPage("/spelen?groep=g1");
    await screen.findByRole("link", { name: /vrijdagavond padel/i });
    expect(screen.getByTestId("matchsectie")).toHaveTextContent("groep:g1");
  });

  it("valt terug op alle groepen bij een ?groep= die niet van jou is", async () => {
    renderPage("/spelen?groep=onbekend");
    await screen.findByRole("link", { name: /vrijdagavond padel/i });
    expect(screen.getByTestId("matchsectie")).toHaveTextContent("groep:alle");
  });

  // #674 A5: het aanmaakformulier stond altijd open en woog even zwaar als de
  // groepen zelf. Nu zit het achter een knop — maar met nul groepen is dít de
  // actie van de pagina, dus dan staat het meteen open.
  it("verbergt het aanmaakformulier achter een knop zodra je een groep hebt", async () => {
    renderPage();
    await screen.findByRole("link", { name: /vrijdagavond padel/i });
    expect(screen.queryByLabelText(/groepsnaam/i)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /groep maken/i }),
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
      screen.getByRole("button", { name: /groep maken/i }),
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
  it("zet de matches onder de groepen", async () => {
    const { container } = renderPage();
    const groepen = await screen.findByRole("region", {
      name: /mijn groepen/i,
    });
    const sectie = screen.getByTestId("matchsectie");
    expect(
      groepen.compareDocumentPosition(sectie) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // De losse-matchkaart is weg; loggen loopt via de knop in de sectie.
    expect(container.querySelector(".hub-los")).toBeNull();
    // Vrije banen blijft een rustige verwijzing, geen kaart.
    expect(
      screen.getByRole("link", { name: /bekijk de banen/i }),
    ).toHaveAttribute("href", "/banen");
  });

  // #1134: "Groep maken" is de hoofdactie van de pagina en staat als knop mét
  // label in de kop. Achteraan de filterrij was hij een naamloos plusje.
  it("zet 'Groep maken' als benoemde actie in de paginakop", async () => {
    const { container } = renderPage();
    await screen.findByRole("link", { name: /vrijdagavond padel/i });

    const knop = screen.getByRole("button", { name: /groep maken/i });
    expect(container.querySelector(".page-head")).toContainElement(knop);
    // En niet als naamloze knop tussen de groepen zelf.
    expect(
      container.querySelector(".mijn-groepen__rij")?.querySelector("button"),
    ).toBeFalsy();
  });

  // De sectie mag de groepen niet zelf ophalen: de pagina heeft ze al, en een
  // tweede lezer op dezelfde data is een tweede plek die kan verouderen (#1134).
  it("geeft de groepenlijst door aan de matchsectie voor het filter", async () => {
    renderPage();
    expect(await screen.findByTestId("matchsectie")).toHaveTextContent(
      "keuze:Vrijdagavond Padel",
    );
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
      screen.getByRole("button", { name: /groep maken/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/detailpagina/i)).not.toBeInTheDocument();
  });

  // #674 B6 gaf een groep die op je stem wacht een eigen accent. Sinds #1134
  // staat die status op de kaart zelf — voor élke groep tegelijk, niet alleen
  // voor de groep die je toevallig aangetikt had.
  it("toont de reisstatus op de kaart zonder dat je hem eerst kiest", async () => {
    renderPage();
    const kaart = await screen.findByRole("link", {
      name: /vrijdagavond padel/i,
    });
    // De fixture-poll staat open → er wordt een stem gevraagd.
    expect(
      await within(kaart).findByText(/stemmen loopt — stem mee/i),
    ).toBeInTheDocument();
    // De stip draagt dezelfde status in vorm (WCAG 1.4.1) en is decoratief.
    expect(kaart.querySelector(".agenda-glyph--open")).not.toBeNull();
  });

  it("laat het aanmaakformulier weer sluiten", async () => {
    renderPage();
    await screen.findByRole("link", { name: /vrijdagavond padel/i });

    const openen = screen.getByRole("button", { name: /groep maken/i });
    await userEvent.click(openen);
    await screen.findByLabelText(/groepsnaam/i);

    // #916: uitklappen had geen tegenhanger.
    await userEvent.click(
      screen.getByRole("button", { name: /formulier sluiten/i }),
    );
    expect(screen.queryByLabelText(/groepsnaam/i)).not.toBeInTheDocument();
    // Focus komt terug op de knop waar je vandaan kwam.
    expect(screen.getByRole("button", { name: /groep maken/i })).toHaveFocus();
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

  // #1298: de hub begon met 131px kop waarvan de subtitel nog polls beloofde
  // (die verhuisden met #1121 naar de agenda), "+ Groep maken" was de
  // nadrukkelijkste knop van het scherm terwijl een groep maken zeldzaam is, en
  // het paneel dat die knop opende stond 269px lager, ná de groepenrij.
  it("houdt de paginakop bij zijn eigen belofte", async () => {
    const { container } = renderPage();
    await screen.findByRole("link", { name: /vrijdagavond padel/i });

    expect(container.querySelector(".page-subtitle")).not.toHaveTextContent(
      /polls?/i,
    );
    // Eén primaire actie op het scherm: de zwevende "+ Match" in de sectie.
    expect(screen.getByRole("button", { name: /groep maken/i })).not.toHaveClass(
      "btn--primary",
    );
  });

  it("opent het aanmaakpaneel bij de knop, niet onder de groepen", async () => {
    const { container } = renderPage();
    await screen.findByRole("link", { name: /vrijdagavond padel/i });

    await userEvent.click(screen.getByRole("button", { name: /groep maken/i }));
    const paneel = (await screen.findByLabelText(/groepsnaam/i)).closest(
      "section",
    )!;
    const groepen = screen.getByRole("region", { name: /mijn groepen/i });
    expect(
      paneel.compareDocumentPosition(groepen) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelector(".page-head")).not.toContainElement(paneel);
  });
});
