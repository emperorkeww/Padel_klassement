import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { makeSupabaseMock } from "@/test/supabaseMock";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", () => ({
  supabase: makeSupabaseMock({
    session: { user: { id: "p1", email: "alice@example.com" } },
    tables: {
      friendships: [
        { id: "f1", requester_id: "p2", addressee_id: "p1", status: "pending" },
        { id: "f2", requester_id: "p1", addressee_id: "p3", status: "accepted" },
        { id: "f3", requester_id: "p1", addressee_id: "p5", status: "pending" },
        // Dave en Frank zijn met elkaar bevriend, niet met Alice. Zulke rijen
        // zijn sinds #326 leesbaar voor de feed en mogen Dave dus niet als
        // "al gekoppeld" laten gelden (#1013).
        { id: "f4", requester_id: "p4", addressee_id: "p6", status: "accepted" },
        // Frank vroeg Alice, Alice weigerde -> Alice mag alsnog toevoegen.
        { id: "f5", requester_id: "p6", addressee_id: "p1", status: "declined" },
        // Alice vroeg Gerd, Gerd weigerde -> dat blijft staan.
        { id: "f6", requester_id: "p1", addressee_id: "p7", status: "declined" },
      ],
      // Drie afgeronde duels Alice vs Carol: genoeg voor MIN_DUELS, zodat de
      // H2H-sneer (en dus de schakelaar) er is (#919).
      teams: [
        { id: "t-a", player1_id: "p1", player2_id: null },
        { id: "t-c", player1_id: "p3", player2_id: null },
      ],
      matches: [1, 2, 3].map((n) => ({
        id: `h2h-${n}`,
        team_a_id: "t-a",
        team_b_id: "t-c",
        status: "completed",
        winner_team_id: n === 3 ? "t-c" : "t-a",
        score_a: n === 3 ? 3 : 6,
        score_b: n === 3 ? 6 : 3,
        played_at: `2026-0${n}-10T18:00:00.000Z`,
        created_at: `2026-0${n}-10T18:00:00.000Z`,
        created_by: "p1",
        group_id: null,
        round_number: null,
        format: "1v1",
      })),
      profiles: [
        { id: "p1", username: "alice", full_name: "Alice Anders" },
        { id: "p2", username: "bob", full_name: "Bob Boers" },
        { id: "p3", username: "carol", full_name: "Carol Claes" },
        { id: "p4", username: "dave", full_name: "Dave De Vos" },
        { id: "p5", username: "eva", full_name: "Eva Evers" },
        { id: "p6", username: "frank", full_name: "Frank Feyen" },
        { id: "p7", username: "gerd", full_name: "Gerd Gijs" },
      ],
    },
    // get_friend_suggestions: dave heeft 2 gemeenschappelijke vrienden (carol + frank).
    rpc: [{ id: "p4", mutual_count: 2, mutual_ids: ["p3", "p6"] }],
  }),
}));

import Friends from "./Friends";
import { coachVrienden } from "@/features/coach/coachMoments";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "@/test/supabaseMock";
import { invalidateAll } from "@/lib/supabase/queryCache";

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Friends />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

// Sinds #919 staan de vijf secties in drie tabs; de meeste tests moeten dus
// eerst naar de juiste tab.
async function openTab(naam: RegExp) {
  await userEvent.click(await screen.findByRole("tab", { name: naam }));
}

/** Typt een zoekterm in "Speler zoeken" (de mock filtert niet: alle profielen komen terug). */
async function zoek(term: string) {
  await userEvent.type(
    await screen.findByPlaceholderText(/zoek op gebruikersnaam/i),
    term,
  );
}

/**
 * De actieknop in de zoekresultaat-rij van één speler. Scopet op de sectie
 * "Speler zoeken", want dezelfde namen staan op deze tab ook onder
 * "Misschien ken je".
 */
async function zoekKnop(naam: RegExp): Promise<HTMLElement> {
  const sectie = (
    await screen.findByRole("heading", { name: /speler zoeken/i })
  ).closest("section") as HTMLElement;
  const rij = (await within(sectie).findByText(naam)).closest(
    ".person-row",
  ) as HTMLElement;
  return within(rij).getByRole("button");
}

describe("<Friends />", () => {
  it("toont inkomend verzoek en bestaande vriend", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /^vrienden$/i }),
    ).toBeInTheDocument();
    // Carol is een geaccepteerde vriend en staat op de eerste tab …
    expect(await screen.findByText(/carol claes/i)).toBeInTheDocument();
    // … Bob stuurde een verzoek en staat dus onder Verzoeken.
    await openTab(/^verzoeken/i);
    expect(await screen.findByText(/bob boers/i)).toBeInTheDocument();
  });

  it("accepteert een inkomend verzoek", async () => {
    renderPage();
    await openTab(/^verzoeken/i);
    await userEvent.click(
      await screen.findByRole("button", { name: /accepteer/i }),
    );
    expect(supabase.from).toHaveBeenCalledWith("friendships");
    expect(await screen.findByText(/geaccepteerd/i)).toBeInTheDocument();
  });

  it("zoekt spelers en stuurt een verzoek naar een nieuwe speler", async () => {
    renderPage();
    await openTab(/^ontdekken/i);
    await zoek("dave");
    // Geen "Zoek"-knop meer (#919): typen zoekt al, met debounce.
    expect(screen.queryByRole("button", { name: /^zoek$/i })).toBeNull();
    // Dave heeft nog geen relatie met Alice: zijn knop is actief.
    const daveKnop = await zoekKnop(/dave de vos/i);
    expect(daveKnop).toHaveTextContent(/verzoek sturen/i);
    expect(daveKnop).toBeEnabled();
    await userEvent.click(daveKnop);
    // De bevestiging spreekt nu met Coach Rudy's stem (#294): deterministisch
    // geseed op het doelwit-id (dave = p4), mijn eigen intensiteit/schild.
    const rivaalQuip = coachVrienden({
      situatie: "nieuw",
      seed: "p4",
      ctx: { intensiteit: "gemeen", schild: false },
    });
    expect(await screen.findByText(rivaalQuip)).toBeInTheDocument();
  });

  // ── #1013 ───────────────────────────────────────────────────────────────
  // De vriendschap Dave–Frank gaat niet over Alice, maar was sinds #326 wel
  // zichtbaar. Dave gold daardoor als "al gekoppeld": uit de suggesties én
  // met een uitgeschakelde knop in de zoekresultaten.

  it("laat een vriendschap tussen twee derden de suggesties niet filteren", async () => {
    renderPage();
    await openTab(/^ontdekken/i);
    expect(
      await within(
        (
          await screen.findByRole("heading", { name: /misschien ken je/i })
        ).closest("section") as HTMLElement,
      ).findByText(/dave de vos/i),
    ).toBeInTheDocument();
  });

  it("benoemt per zoekresultaat wat de relatie is", async () => {
    renderPage();
    await openTab(/^ontdekken/i);
    await zoek("er");

    // Carol is een vriend, Bob vroeg mij, Eva kreeg mijn verzoek.
    expect(await zoekKnop(/carol claes/i)).toHaveTextContent(/al vrienden/i);
    expect(await zoekKnop(/bob boers/i)).toHaveTextContent(/verzoek ontvangen/i);
    expect(await zoekKnop(/eva evers/i)).toHaveTextContent(/verzoek verstuurd/i);
    // Het generieke label is weg; het zei niets over waar je op wacht.
    expect(screen.queryByRole("button", { name: /al gekoppeld/i })).toBeNull();
  });

  it("heropent een verzoek dat ik zelf geweigerd heb", async () => {
    renderPage();
    await openTab(/^ontdekken/i);
    await zoek("er");

    // Gerd weigerde mij: dat blijft staan.
    const gerd = await zoekKnop(/gerd gijs/i);
    expect(gerd).toHaveTextContent(/verzoek geweigerd/i);
    expect(gerd).toBeDisabled();

    // Frank vroeg mij en ik weigerde: geen doodlopende weg meer.
    const frank = await zoekKnop(/frank feyen/i);
    expect(frank).toHaveTextContent(/alsnog toevoegen/i);
    expect(frank).toBeEnabled();

    // Dat de heropening een delete + een verse insert is, staat in api.test.ts;
    // hier telt dat de knop werkt en Rudy de nieuwe rivaal begroet.
    await userEvent.click(frank);
    expect(supabase.from).toHaveBeenCalledWith("friendships");
    const rivaalQuip = coachVrienden({
      situatie: "nieuw",
      seed: "p6",
      ctx: { intensiteit: "gemeen", schild: false },
    });
    expect(await screen.findByText(rivaalQuip)).toBeInTheDocument();
  });

  // #924: "Zoeken…" meldde het begin, de uitkomst kwam geluidloos binnen.
  it("kondigt het aantal zoekresultaten aan", async () => {
    renderPage();
    await openTab(/^ontdekken/i);
    await userEvent.type(
      await screen.findByPlaceholderText(/zoek op gebruikersnaam/i),
      "dave",
    );
    await screen.findAllByRole("button", { name: /verzoek sturen/i });

    expect(await screen.findByText(/spelers? gevonden\./)).toBeInTheDocument();
  });

  it("opent de gemeenschappelijke vrienden in een popup", async () => {
    renderPage();
    await openTab(/^ontdekken/i);
    expect(
      await screen.findByRole("heading", { name: /misschien ken je/i }),
    ).toBeInTheDocument();
    // Dave (p4) is voorgesteld met een klikbare teller; de namen zijn verborgen.
    expect(await screen.findByText(/dave de vos/i)).toBeInTheDocument();
    const toggle = await screen.findByRole("button", {
      name: /2 gemeenschappelijke vrienden/i,
    });
    expect(screen.queryByText(/frank feyen/i)).toBeNull();
    // Na klikken opent een dialoog met de gemeenschappelijke vrienden.
    await userEvent.click(toggle);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText(/frank feyen/i)).toBeInTheDocument();
  });

  it("trekt een verzonden verzoek in", async () => {
    renderPage();
    await openTab(/^verzoeken/i);
    await userEvent.click(
      await screen.findByRole("button", { name: /intrekken/i }),
    );
    expect(supabase.from).toHaveBeenCalledWith("friendships");
    expect(await screen.findByText(/verzoek ingetrokken/i)).toBeInTheDocument();
  });

  it("toont een foutstaat i.p.v. lege lijsten als vrienden laden faalt", async () => {
    // Verse cache, en de friendships-query laten falen (issue #67).
    invalidateAll();
    const fromMock = supabase.from as unknown as {
      getMockImplementation: () => (table: string) => unknown;
      mockImplementation: (impl: (table: string) => unknown) => void;
    };
    const orig = fromMock.getMockImplementation();
    fromMock.mockImplementation((table) =>
      table === "friendships"
        ? makeQuery({ data: null, error: new Error("boem") })
        : orig(table),
    );
    try {
      renderPage();
      expect(
        await screen.findByText(/je vrienden laden mislukte/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /opnieuw proberen/i }),
      ).toBeInTheDocument();
      // Geen misleidende lege staten.
      expect(screen.queryByText(/geen openstaande verzoeken/i)).toBeNull();
      expect(screen.queryByText(/nog geen vrienden/i)).toBeNull();
    } finally {
      fromMock.mockImplementation(orig);
      invalidateAll();
    }
  });

  it("verwijdert een vriend na bevestiging (#68)", async () => {
    renderPage();
    // Sinds #919 zit verwijderen in het ⋯-menu van de rij, niet als rode knop
    // naast elke vriend. De bevestiging bleef.
    await userEvent.click(
      await screen.findByRole("button", { name: /meer bij carol/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /vriend verwijderen/i }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: /vriend verwijderen/i,
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: /verwijderen/i }),
    );
    expect(await screen.findByText(/^verwijderd\.$/i)).toBeInTheDocument();
  });

  // ── #919 ────────────────────────────────────────────────────────────────

  it("verdeelt de vijf secties over drie tabs, met tellers", async () => {
    renderPage();
    await screen.findByRole("tablist", { name: /vriendenonderdelen/i });

    // Vrienden staat vooraan; verzoeken draagt een teller zodat je ziet dat er
    // iets ligt zonder te scrollen.
    expect(screen.getByRole("tab", { name: /^vrienden/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await screen.findByRole("tab", { name: /verzoeken, \d+/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^ontdekken$/i })).toBeInTheDocument();

    // Zoeken hoort bij Ontdekken en staat dus niet meteen in beeld.
    expect(screen.queryByPlaceholderText(/zoek op gebruikersnaam/i)).toBeNull();
    await openTab(/^ontdekken$/i);
    expect(
      screen.getByPlaceholderText(/zoek op gebruikersnaam/i),
    ).toBeInTheDocument();
  });

  it("wist de zoekterm met de wis-knop", async () => {
    renderPage();
    await openTab(/^ontdekken$/i);
    const veld = await screen.findByPlaceholderText(/zoek op gebruikersnaam/i);
    await userEvent.type(veld, "dave");
    expect(veld).toHaveValue("dave");

    await userEvent.click(
      screen.getByRole("button", { name: /zoekterm wissen/i }),
    );
    expect(veld).toHaveValue("");
  });

  it("houdt verwijderen uit de vriendenrij zelf", async () => {
    renderPage();
    await screen.findByText(/carol claes/i);
    // Geen losse rode knop meer naast elke vriend.
    expect(screen.queryByRole("button", { name: /^verwijderen$/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /meer bij carol/i }),
    ).toBeInTheDocument();
  });

  it("dempt Rudy's onderlinge balans en onthoudt dat", async () => {
    const { unmount } = renderPage();
    // Sinds #945 dezelfde schakelaar als de instellingen: role="switch", dus
    // een schermlezer zegt "aan/uit" in plaats van "aangevinkt".
    const schakelaar = await screen.findByRole("switch", {
      name: /onderlinge balans tonen/i,
    });
    expect(schakelaar).toBeChecked();

    await userEvent.click(schakelaar);
    expect(schakelaar).not.toBeChecked();

    // De keuze overleeft een remount (localStorage-vlag).
    unmount();
    renderPage();
    expect(
      await screen.findByRole("switch", { name: /onderlinge balans tonen/i }),
    ).not.toBeChecked();
  });

  // Twee segmented controls onder elkaar met identiek gewicht, en de actieve
  // tab er direct onder nóg eens als sectiekop (#945).
  it("houdt één navigatieniveau en herhaalt de actieve tab niet", async () => {
    renderPage();
    await screen.findByRole("tab", { name: /vrienden/i });
    // De account-wissel is geen tweede tabbalk meer maar een gewone link.
    expect(
      screen.queryByRole("navigation", { name: /account/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /naar je profiel/i }),
    ).toHaveAttribute("href", "/profiel");
    // En de kop onder de tab herhaalt de teller niet meer zichtbaar.
    expect(
      screen.queryByRole("heading", { name: /mijn vrienden \d/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^mijn vrienden$/i }),
    ).toHaveClass("sr-only");
  });
});
