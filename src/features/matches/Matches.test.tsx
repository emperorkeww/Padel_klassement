import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openPlannedCards } from "@/test/plannedCard";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES, rpc: "m-new" }) };
});

import Matches from "./Matches";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "@/test/supabaseMock";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { MATCH_DONE } from "@/test/fixtures";

function renderPage(url = "/") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <ToastProvider>
          <Matches />
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

describe("<Matches />", () => {
  it("toont Te spelen met inline invoer en de recente matches", async () => {
    renderPage();
    expect(await screen.findByText(/te spelen/i)).toBeInTheDocument();
    // De score-invoer zit sinds #941 achter de uitklapknop van de kaart.
    await openPlannedCards();
    // De geplande match heeft twee score-invoervelden met teamnamen als label.
    expect(
      await screen.findByLabelText(/^score alice anders & bob boers$/i),
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

  it("logt een match via de wizard (spelers → score → opslaan)", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /match loggen/i }),
    );
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

    await userEvent.type(sheet.getByLabelText("Score team A"), "6");
    await userEvent.type(sheet.getByLabelText("Score team B"), "4");
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
    await userEvent.click(
      await screen.findByRole("button", { name: /^match plannen$/i }),
    );
    const sheet = within(await screen.findByRole("dialog"));
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
    await userEvent.click(
      await screen.findByRole("button", { name: /^match plannen$/i }),
    );
    const sheet = within(await screen.findByRole("dialog"));
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
    await userEvent.click(
      await screen.findByRole("button", { name: /match loggen/i }),
    );
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ── #914 ────────────────────────────────────────────────────────────────

  it("heeft één primaire actie: loggen zweeft, plannen staat in de kop", async () => {
    const { container } = renderPage();
    await screen.findByText(/recente matches/i);

    const log = screen.getByRole("button", { name: /match loggen/i });
    expect(log).toHaveClass("matches__fab");
    // Plaatsing én uitwijkgedrag komen van de gedeelde klasse (#942): dezelfde
    // die de "Jouw positie"-chip van het klassement draagt.
    expect(log).toHaveClass("zwevende-actie");
    // De kop draagt alleen nog de secundaire actie.
    const kop = container.querySelector(".page-head")!;
    expect(
      within(kop as HTMLElement).getByRole("button", { name: /match plannen/i }),
    ).toBeInTheDocument();
    expect(
      within(kop as HTMLElement).queryByRole("button", { name: /match loggen/i }),
    ).toBeNull();
  });

  it("reserveert de ruimte van 'Te spelen' tijdens het laden", async () => {
    const { container } = renderPage();
    // Meteen bij de eerste render: kop staat er, kaarten nog niet.
    expect(screen.getByText(/te spelen/i)).toBeInTheDocument();
    expect(container.querySelector(".sk")).not.toBeNull();
    expect(
      screen.queryByLabelText(/^score alice anders & bob boers$/i),
    ).toBeNull();

    // En zodra de data er is, staat de echte inhoud er.
    await openPlannedCards();
    expect(
      await screen.findByLabelText(/^score alice anders & bob boers$/i),
    ).toBeInTheDocument();
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

  it("houdt de dagkoppen in de historie (#914, bevinding 5)", async () => {
    const { container } = renderPage();
    await screen.findByText("6–3");
    expect(container.querySelector(".match-day__title")).not.toBeNull();
  });
});
