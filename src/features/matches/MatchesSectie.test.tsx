import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openScoreSheets } from "@/test/plannedCard";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES, rpc: "m-new" }) };
});

import { MatchesSectie } from "./MatchesSectie";
import { useSpeelParams } from "./speelParams";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "@/test/supabaseMock";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { MATCH_DONE, MATCH_PLANNED } from "@/test/fixtures";

/** De sectie zoals de Spelen-hub hem monteert (#1123): met de échte
 *  URL-bedrading eromheen, zodat de filter- en ?log=1-tests toetsen wat er in
 *  de app gebeurt en niet wat een testkopie van die bedrading doet. */
function Harnas({ initieelZichtbaar }: { initieelZichtbaar?: number }) {
  const speel = useSpeelParams();
  return (
    <MatchesSectie
      initieelZichtbaar={initieelZichtbaar}
      groepId={speel.groep}
      onGroep={speel.zetGroep}
      groepen={[{ id: "g1", name: "Vrijdagavond padel" }]}
      periode={speel.periode}
      onPeriode={speel.zetPeriode}
      onWisFilters={speel.wisFilters}
      logDirect={speel.logDirect}
      onLogVerbruikt={speel.verbruikLog}
    />
  );
}

function renderPage(url = "/", initieelZichtbaar?: number) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <ToastProvider>
          <Harnas initieelZichtbaar={initieelZichtbaar} />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Vervangt tijdelijk wat de matches-tabel teruggeeft; geeft een
 *  herstelfunctie terug. Respecteert de limit() van de aanroeper, zodat het
 *  "toon oudere matches"-pad echt getoetst wordt. */
function metMatches(rijen: unknown[]) {
  invalidateAll();
  const fromMock = supabase.from as unknown as {
    getMockImplementation: () => (table: string) => unknown;
    mockImplementation: (impl: (table: string) => unknown) => void;
  };
  const orig = fromMock.getMockImplementation();
  fromMock.mockImplementation((t) =>
    t === "matches" ? makeQuery({ data: rijen, error: null }) : orig(t),
  );
  return () => {
    fromMock.mockImplementation(orig);
    invalidateAll();
  };
}

/** n afgeronde matches, elk op een eigen dag, zonder groep. */
const veelMatches = (n: number, groupId: string | null = null) =>
  Array.from({ length: n }, (_, i) => {
    const ts = new Date(Date.UTC(2026, 6, 3) - i * 86_400_000).toISOString();
    return {
      ...MATCH_DONE,
      id: `bulk-${i}`,
      group_id: groupId,
      round_number: null,
      played_at: ts,
      created_at: ts,
    };
  });

describe("<MatchesSectie />", () => {
  it("toont Te spelen met de uitslag-sheet en de recente matches", async () => {
    renderPage();
    expect(await screen.findByText(/te spelen/i)).toBeInTheDocument();
    // De score-invoer zit sinds #1144 in een sheet achter de primaire knop.
    await openScoreSheets();
    // De sheet heeft per team één invoerveld, met de teamnaam als label.
    expect(
      await screen.findByRole("spinbutton", {
        name: /^score alice anders & bob boers$/i,
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/recente matches/i)).toBeInTheDocument();
    // De afgeronde match staat in de lijst met de eindscore.
    expect(await screen.findByText("6–3")).toBeInTheDocument();
  });

  it("filtert op Gewonnen", async () => {
    renderPage();
    await screen.findByText("6–3");
    await userEvent.click(screen.getByRole("button", { name: /^gewonnen$/i }));
    expect(screen.getByText("6–3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^verloren$/i }));
    expect(screen.queryByText("6–3")).not.toBeInTheDocument();
    expect(
      screen.getByText(/geen enkele nederlaag te bekennen/i),
    ).toBeInTheDocument();
  });

  // #924: de rij had geen rol en dus geen hoorbare ingedrukt-staat — het zijn
  // filters, geen tabbladen.
  it("presenteert de historie-filters als groep schakelknoppen", async () => {
    renderPage();
    await screen.findByText("6–3");

    expect(
      screen.getByRole("group", { name: /historie filteren/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^alles/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: /^gewonnen$/i }));
    expect(screen.getByRole("button", { name: /^gewonnen$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("logt een match via de wizard (spelers → score → opslaan)", async () => {
    renderPage();
    // Eén zwevende knop (#1123); loggen is de stand waarin het sheet opent.
    await userEvent.click(await screen.findByRole("button", { name: /^match$/i }));
    const sheet = within(await screen.findByRole("dialog"));
    expect(sheet.getByText(/wie speelden er/i)).toBeInTheDocument();

    // Buiten groepscontext kun je de match optioneel aan een groep koppelen
    // (#361); hier kiezen we de fixture-groep.
    await userEvent.selectOptions(
      await sheet.findByLabelText(/koppel aan groep/i),
      "g1",
    );

    // Vier spelers aantikken: eerst team A (Alice + Bob), dan team B.
    for (const naam of [/alice anders/i, /bob boers/i, /carol claes/i, /dave de vos/i]) {
      await userEvent.click(sheet.getByRole("button", { name: naam }));
    }
    expect(sheet.getByText(/team a/i)).toBeInTheDocument();
    await userEvent.click(sheet.getByRole("button", { name: /naar de score/i }));

    await userEvent.type(sheet.getByRole("spinbutton", { name: /^Score Alice/ }), "6");
    await userEvent.type(sheet.getByRole("spinbutton", { name: /^Score Carol/ }), "4");
    expect(sheet.getByText(/winnen — 3 punten/i)).toBeInTheDocument();

    await userEvent.click(sheet.getByRole("button", { name: /match opslaan/i }));
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_completed_match",
      expect.objectContaining({
        p_winner: "a",
        p_score_a: 6,
        p_score_b: 4,
        p_group_id: "g1",
      }),
    );
    // Sheet sluit na opslaan.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("plant een match via de wizard (spelers → tijdstip → plannen)", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /^match$/i }));
    const sheet = within(await screen.findByRole("dialog"));
    // Plannen is sinds #1123 een keuze ín het sheet, niet een tweede knop op
    // de pagina.
    await userEvent.click(sheet.getByRole("radio", { name: /match plannen/i }));
    expect(sheet.getByText(/wie spelen er/i)).toBeInTheDocument();

    for (const naam of [/alice anders/i, /bob boers/i, /carol claes/i, /dave de vos/i]) {
      await userEvent.click(sheet.getByRole("button", { name: naam }));
    }
    await userEvent.click(sheet.getByRole("button", { name: /naar plannen/i }));
    expect(sheet.getByText(/wanneer spelen jullie/i)).toBeInTheDocument();

    // Zonder tijdstip plannen kan gewoon; de match komt bij "Te spelen".
    // Zonder groep-keuze blijft het een losse match (default, #361).
    await userEvent.click(
      sheet.getByRole("button", { name: /^match plannen$/i }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_planned_match",
      expect.objectContaining({ p_played_at: undefined, p_group_id: undefined }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("plant een match gekoppeld aan een groep (#361)", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /^match$/i }));
    const sheet = within(await screen.findByRole("dialog"));
    await userEvent.click(sheet.getByRole("radio", { name: /match plannen/i }));
    await userEvent.selectOptions(
      await sheet.findByLabelText(/koppel aan groep/i),
      "g1",
    );
    for (const naam of [/alice anders/i, /bob boers/i, /carol claes/i, /dave de vos/i]) {
      await userEvent.click(sheet.getByRole("button", { name: naam }));
    }
    await userEvent.click(sheet.getByRole("button", { name: /naar plannen/i }));
    await userEvent.click(
      sheet.getByRole("button", { name: /^match plannen$/i }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_planned_match",
      expect.objectContaining({ p_group_id: "g1" }),
    );
  });

  it("sluit de wizard met Escape", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /^match$/i }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ── #914 ────────────────────────────────────────────────────────────────

  it("heeft één primaire actie: de zwevende knop, met de keuze in het sheet", async () => {
    renderPage();
    await screen.findByText(/recente matches/i);

    const knop = screen.getByRole("button", { name: /^match$/i });
    expect(knop).toHaveClass("matches__fab");
    // Plaatsing én uitwijkgedrag komen van de gedeelde klasse (#942): dezelfde
    // die de "Jouw positie"-chip van het klassement draagt.
    expect(knop).toHaveClass("zwevende-actie");
    // Loggen én plannen lopen allebei via deze ene knop (#1123), zodat op
    // telefoonbreedte niet twee knoppen om de hoofdrol concurreren. De sectie
    // draagt zelf geen tweede actie.
    expect(
      screen.queryByRole("button", { name: /^match plannen$/i }),
    ).toBeNull();

    // De keuze tussen loggen en plannen staat in stap 1 van het sheet.
    await userEvent.click(knop);
    const sheet = within(await screen.findByRole("dialog"));
    expect(
      sheet.getByRole("radio", { name: /uitslag loggen/i }),
    ).toBeChecked();
    expect(sheet.getByRole("radio", { name: /match plannen/i })).toBeInTheDocument();
  });

  it("reserveert de ruimte van 'Te spelen' tijdens het laden", async () => {
    const { container } = renderPage();
    // Meteen bij de eerste render: kop staat er, kaarten nog niet.
    expect(screen.getByText(/te spelen/i)).toBeInTheDocument();
    expect(container.querySelector(".sk")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /uitslag invullen/i }),
    ).toBeNull();

    // En zodra de data er is, staat de echte kaart er met haar primaire actie.
    expect(
      await screen.findByRole("button", { name: /uitslag invullen/i }),
    ).toBeInTheDocument();
  });

  // #106/#1123: de hub linkt met "?log=1" naar deze pagina om meteen te kunnen
  // loggen. Sinds #1123 loopt dat via de sectie en ruimt de pagina de parameter
  // op — anders opent het sheet opnieuw bij elke refresh.
  it("opent het log-sheet meteen bij ?log=1 en houdt de groepsfilter heel", async () => {
    renderPage("/?log=1&periode=7d");
    const sheet = within(await screen.findByRole("dialog"));
    // Vast op loggen: wie hierheen komt om te loggen krijgt geen keuzevraag.
    expect(sheet.getByText(/wie speelden er/i)).toBeInTheDocument();
    expect(sheet.queryByRole("radio", { name: /match plannen/i })).toBeNull();
    // De andere parameter blijft staan; alleen "log" wordt verbruikt.
    expect(screen.getByLabelText("Periode")).toHaveValue("7d");
  });

  it("filtert op periode en bewaart de keuze in de URL", async () => {
    // Eén match van vandaag, één van ruim een maand terug.
    const herstel = metMatches([
      { ...MATCH_DONE, id: "vers", played_at: new Date().toISOString() },
      {
        ...MATCH_DONE,
        id: "oud",
        score_a: 1,
        score_b: 6,
        played_at: "2020-01-05T18:00:00.000Z",
        created_at: "2020-01-05T18:00:00.000Z",
      },
    ]);
    try {
      renderPage();
      await screen.findByText("6–3");
      expect(screen.getByText("1–6")).toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText("Periode"), "7d");
      expect(screen.getByText("6–3")).toBeInTheDocument();
      expect(screen.queryByText("1–6")).toBeNull();

      // Wissen brengt de oude match terug.
      await userEvent.click(screen.getByRole("button", { name: /wis filters/i }));
      expect(screen.getByText("1–6")).toBeInTheDocument();
    } finally {
      herstel();
    }
  });

  // #924: de historie krimpt bij het filteren zonder dat iets dat meldt.
  it("kondigt aan hoeveel matches het filter overlaat", async () => {
    const herstel = metMatches([
      { ...MATCH_DONE, id: "vers", played_at: new Date().toISOString() },
      {
        ...MATCH_DONE,
        id: "oud",
        score_a: 1,
        score_b: 6,
        played_at: "2020-01-05T18:00:00.000Z",
        created_at: "2020-01-05T18:00:00.000Z",
      },
    ]);
    try {
      renderPage();
      await screen.findByText("6–3");

      await userEvent.selectOptions(screen.getByLabelText("Periode"), "7d");
      expect(
        await screen.findByText(/1 match in de historie\./),
      ).toBeInTheDocument();
    } finally {
      herstel();
    }
  });

  // #1134: filteren op groep is iets anders dan een groep binnengaan, en heeft
  // dus een eigen bediening. Tot #1123 stond dit filter hier al; dat issue gaf
  // de rol aan de chipstrook, die hem naast het navigeren droeg.
  it("filtert op groep en wist met de periode mee", async () => {
    const herstel = metMatches([
      { ...MATCH_DONE, id: "in-groep", group_id: "g1" },
      { ...MATCH_DONE, id: "los", score_a: 1, score_b: 6, group_id: null },
    ]);
    try {
      renderPage();
      await screen.findByText("6–3");
      expect(screen.getByText("1–6")).toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText("Groep"), "g1");
      expect(screen.getByText("6–3")).toBeInTheDocument();
      // Een losse match hoort bij geen enkele groep en valt dus buiten de keuze.
      expect(screen.queryByText("1–6")).toBeNull();

      await userEvent.click(screen.getByRole("button", { name: /wis filters/i }));
      expect(screen.getByLabelText("Groep")).toHaveValue("");
      expect(screen.getByText("1–6")).toBeInTheDocument();
    } finally {
      herstel();
    }
  });

  it("leest het groepsfilter uit de URL", async () => {
    const herstel = metMatches([
      { ...MATCH_DONE, id: "in-groep", group_id: "g1" },
      { ...MATCH_DONE, id: "los", score_a: 1, score_b: 6, group_id: null },
    ]);
    try {
      renderPage("/?groep=g1");
      expect(await screen.findByText("6–3")).toBeInTheDocument();
      expect(screen.getByLabelText("Groep")).toHaveValue("g1");
      expect(screen.queryByText("1–6")).toBeNull();
    } finally {
      herstel();
    }
  });

  it("leest het periodefilter uit de URL", async () => {
    const herstel = metMatches([
      { ...MATCH_DONE, id: "vers", played_at: new Date().toISOString() },
      {
        ...MATCH_DONE,
        id: "oud",
        score_a: 1,
        score_b: 6,
        played_at: "2020-01-05T18:00:00.000Z",
        created_at: "2020-01-05T18:00:00.000Z",
      },
    ]);
    try {
      renderPage("/?periode=7d");
      await screen.findByText("6–3");
      expect(screen.getByLabelText("Periode")).toHaveValue("7d");
      expect(screen.queryByText("1–6")).toBeNull();
    } finally {
      herstel();
    }
  });

  it("meldt de afkapping en laadt oudere matches bij", async () => {
    // Precies de paginagrootte terug = er zit waarschijnlijk meer achter.
    const herstel = metMatches(veelMatches(100));
    try {
      renderPage();
      expect(
        await screen.findByText(/alleen de laatste 100 matches zijn geladen/i),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: /toon oudere matches/i }),
      );
      // Nu vraagt de pagina 200 op; de mock geeft er 100, dus dit is alles.
      expect(
        await screen.findByText(/recente matches/i),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/alleen de laatste/i),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: /toon oudere matches/i }),
      ).toBeNull();
    } finally {
      herstel();
    }
  });

  // #1298: "Te spelen" leidde zijn lijst af zónder de filters die de historie
  // eronder wél kreeg. Op elke groepscontext stonden dus dezelfde vier geplande
  // matches, mét de knop "Uitslag invullen".
  it("houdt Te spelen binnen het groepsfilter", async () => {
    const herstel = metMatches([
      { ...MATCH_DONE, id: "in-groep", group_id: "g1" },
      { ...MATCH_PLANNED, id: "plan-g1", group_id: "g1" },
      { ...MATCH_PLANNED, id: "plan-elders", group_id: "g2" },
      { ...MATCH_PLANNED, id: "plan-los", group_id: null },
    ]);
    try {
      renderPage();
      // Zonder groepskeuze staan ze er alle drie.
      expect(await screen.findByText(/te spelen/i)).toBeInTheDocument();
      const alles = screen.getByText(/te spelen/i).closest("section")!;
      expect(within(alles).getByText("3")).toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText("Groep"), "g1");
      const gefilterd = screen.getByText(/te spelen/i).closest("section")!;
      // Alleen de geplande match van deze groep blijft over.
      expect(within(gefilterd).getByText("1")).toBeInTheDocument();
    } finally {
      herstel();
    }
  });

  it("houdt Te spelen binnen het periodefilter", async () => {
    const herstel = metMatches([
      { ...MATCH_DONE, id: "vers", played_at: new Date().toISOString() },
      {
        ...MATCH_PLANNED,
        id: "plan-oud",
        played_at: "2020-01-05T18:00:00.000Z",
        created_at: "2020-01-05T18:00:00.000Z",
      },
    ]);
    try {
      renderPage();
      expect(await screen.findByText(/te spelen/i)).toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText("Periode"), "7d");
      expect(screen.queryByText(/te spelen/i)).toBeNull();
      // En de geplande match glipt ook niet alsnog de historie in.
      expect(await screen.findByText(/1 match in de historie\./)).toBeInTheDocument();
    } finally {
      herstel();
    }
  });

  // #1298: de hub rendert de hele historie in één keer — 62 kaarten en 56
  // dagkoppen, 10.037px lang, met de verwijzing naar de banen op 9.814px.
  it("kort de historie in en toont de rest achter één knop", async () => {
    const herstel = metMatches(veelMatches(30));
    try {
      const { container } = renderPage("/", 15);
      await screen.findByText(/recente matches/i);
      await waitFor(() =>
        expect(container.querySelectorAll(".match-card")).toHaveLength(15),
      );

      // Eén knop, niet twee: het serverplafond meldt zich pas als alles staat.
      expect(screen.queryByText(/alleen de laatste/i)).toBeNull();
      await userEvent.click(
        screen.getByRole("button", { name: /toon oudere matches \(15\)/i }),
      );
      expect(container.querySelectorAll(".match-card")).toHaveLength(30);
      expect(
        screen.queryByRole("button", { name: /toon oudere matches \(/i }),
      ).toBeNull();
    } finally {
      herstel();
    }
  });

  it("laat de groepspagina de volledige historie houden", async () => {
    const herstel = metMatches(veelMatches(30));
    try {
      const { container } = renderPage();
      await screen.findByText(/recente matches/i);
      await waitFor(() =>
        expect(container.querySelectorAll(".match-card")).toHaveLength(30),
      );
    } finally {
      herstel();
    }
  });

  it("houdt de dagkoppen in de historie (#914, bevinding 5)", async () => {
    const { container } = renderPage();
    await screen.findByText("6–3");
    expect(container.querySelector(".match-day__title")).not.toBeNull();
  });
});
