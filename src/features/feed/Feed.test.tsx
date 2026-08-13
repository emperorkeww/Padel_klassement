import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import Feed from "./Feed";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "@/test/supabaseMock";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { MATCH_DONE, PROFILES } from "@/test/fixtures";

/** Vervangt tijdelijk wat een of meer tabellen teruggeven; geeft een
 *  herstelfunctie terug. */
function overrideTabellen(rijen: Record<string, unknown[]>) {
  invalidateAll();
  const fromMock = supabase.from as unknown as {
    getMockImplementation: () => (table: string) => unknown;
    mockImplementation: (impl: (table: string) => unknown) => void;
  };
  const orig = fromMock.getMockImplementation();
  fromMock.mockImplementation((t) =>
    t in rijen ? makeQuery({ data: rijen[t], error: null }) : orig(t),
  );
  return () => {
    fromMock.mockImplementation(orig);
    invalidateAll();
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Feed />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<Feed />", () => {
  /** Drie of meer opeenvolgende vriendschappen staan sinds #944 samengevat
   *  achter één regel; de fixtures leveren er precies drie. */
  async function openVriendschapsbundel() {
    fireEvent.click(
      await screen.findByRole("button", { name: /nieuwe vriendschappen/i }),
    );
  }

  it("toont matches en vriendschappen chronologisch met dag-kopjes", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /^clubblad$/i }),
    ).toBeInTheDocument();

    // De afgeronde match uit de fixtures (alice+bob vs carol+dave) is een
    // klikbare matchkaart …
    const list = await screen.findByRole("list", {
      name: /recente gebeurtenissen/i,
    });
    expect(list).toHaveTextContent(/alice/i);
    // … en alice' geaccepteerde vriendschappen staan er samengevat tussen,
    // met de losse regels één tik verderop (#944).
    await openVriendschapsbundel();
    expect(
      (await screen.findAllByText(/zijn nu vrienden/i)).length,
    ).toBeGreaterThan(0);
  });

  it("filtert de feed op soort via de chips", async () => {
    renderPage();
    const list = await screen.findByRole("list", {
      name: /recente gebeurtenissen/i,
    });
    // Ongefilterd bevat de lijst de matchkaart (met Alice erin) …
    expect(list).toHaveTextContent(/alice/i);

    // … na "Sociaal" alleen nog vriendschapsregels (Alice heet daar "Jij").
    fireEvent.click(screen.getByRole("button", { name: "Sociaal" }));
    await openVriendschapsbundel();
    expect(screen.getAllByText(/zijn nu vrienden/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("list", { name: /recente gebeurtenissen/i }),
    ).not.toHaveTextContent(/alice/i);

    // Terug naar "Alles" toont de matchkaart weer.
    fireEvent.click(screen.getByRole("button", { name: "Alles" }));
    expect(
      screen.getByRole("list", { name: /recente gebeurtenissen/i }),
    ).toHaveTextContent(/alice/i);
  });

  it("houdt dag-kopjes decoratief en chip-labels als exacte knopnaam", async () => {
    renderPage();
    const list = await screen.findByRole("list", {
      name: /recente gebeurtenissen/i,
    });
    // Dag-scheiders zijn visueel (aria-hidden): de dag staat al op elk item.
    const dagen = list.querySelectorAll(".feed__day");
    expect(dagen.length).toBeGreaterThan(0);
    dagen.forEach((d) => expect(d).toHaveAttribute("aria-hidden", "true"));

    // Stip en telling op een chip zijn decoratie: de accessible name blijft
    // exact het filterlabel (regressiewacht voor de aria-hidden-decoratie).
    expect(screen.getByRole("button", { name: "Roast" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Matches" })).toBeInTheDocument();
  });

  // #912: de rij was een kale <div className="tabs"> met losse buttons — geen
  // rol, geen ingedrukt-staat. Het zijn filters, geen tabbladen (daarom bleef
  // dit liggen in #910).
  it("presenteert de filterrij als groep schakelknoppen", async () => {
    renderPage();
    const groep = await screen.findByRole("group", { name: /clubblad filteren/i });
    expect(groep).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Alles" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Sociaal" }));
    expect(screen.getByRole("button", { name: "Sociaal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Alles" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  // #924: de chip krijgt aria-pressed, maar wát het filter oplevert hoorde je
  // nergens — de lijst wisselt geluidloos.
  it("kondigt de uitkomst van een filterwissel aan", async () => {
    renderPage();
    await screen.findByRole("group", { name: /clubblad filteren/i });

    // Bij het laden blijft de regio stil.
    const regios = screen.getAllByRole("status");
    expect(regios.some((r) => /filter/i.test(r.textContent ?? ""))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Sociaal" }));
    expect(await screen.findByText(/^Filter Sociaal: .* berichten\.$/)).toBeInTheDocument();
  });

  it("wist een actief filter via de wis-knop én via de chip zelf", async () => {
    renderPage();
    await screen.findByRole("group", { name: /clubblad filteren/i });

    // Zonder actief filter is er niets te wissen.
    expect(screen.queryByRole("button", { name: /wis filter/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sociaal" }));
    fireEvent.click(screen.getByRole("button", { name: /wis filter/i }));
    expect(screen.getByRole("button", { name: "Alles" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // En nogmaals op de actieve chip tikken doet hetzelfde — wat je bij een
    // schakelchip verwacht.
    fireEvent.click(screen.getByRole("button", { name: "Sociaal" }));
    fireEvent.click(screen.getByRole("button", { name: "Sociaal" }));
    expect(screen.getByRole("button", { name: "Sociaal" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByRole("button", { name: /wis filter/i })).toBeNull();
  });

  it("groepeert de items per dag zodat de dagkop kan blijven plakken (#912)", async () => {
    const { container } = renderPage();
    await screen.findByRole("list", { name: /recente gebeurtenissen/i });

    // Elk dagblok is een eigen element met de kop en zijn eigen itemlijst; in
    // de vroegere platte grid kon een sticky kop zijn eigen rij niet verlaten.
    const dagen = container.querySelectorAll(".feed__dag");
    expect(dagen.length).toBeGreaterThan(0);
    for (const dag of dagen) {
      expect(dag.querySelector(".feed__items")).not.toBeNull();
      // De kop verdient zijn ruimte pas vanaf twee rijen (#1272): boven één
      // regel is hij hoger dan wat eronder staat.
      const rijen = dag.querySelectorAll(":scope > .feed__items > li").length;
      expect(Boolean(dag.querySelector(".feed__day"))).toBe(rijen > 1);
    }
  });

  // #1272: tien van de achttien dagblokken bestonden uit één regel, en daarboven
  // is de kop (hoofdletters + hairline + lucht) hoger dan de inhoud eronder.
  it("laat de dagkop weg boven een dag met één regel, en houdt hem op drukke dagen", async () => {
    // Twee losse dagen met elk één match, en één dag met er drie.
    const dag = (d: number, n: number) =>
      Array.from({ length: n }, (_, i) => {
        const ts = new Date(Date.UTC(2026, 3, d, 18 + i)).toISOString();
        return {
          ...MATCH_DONE,
          id: `d${d}-${i}`,
          group_id: null,
          round_number: null,
          played_at: ts,
          created_at: ts,
        };
      });
    const herstel = overrideTabellen({
      matches: [...dag(10, 3), ...dag(8, 1), ...dag(6, 1)],
    });
    try {
      const { container } = renderPage();
      await screen.findByRole("list", { name: /recente gebeurtenissen/i });

      const dagen = [...container.querySelectorAll(".feed__dag")].map((d) => ({
        rijen: d.querySelectorAll(":scope > .feed__items > li").length,
        kop: Boolean(d.querySelector(".feed__day")),
      }));
      // De drie matches van 10 april vormen het drukke blok; de twee losse
      // dagen eromheen houden hun regel zonder kop erboven.
      expect(dagen.filter((d) => d.rijen === 1).length).toBeGreaterThanOrEqual(2);
      expect(dagen.filter((d) => d.rijen === 1).every((d) => !d.kop)).toBe(true);
      expect(dagen.filter((d) => d.rijen > 1).length).toBeGreaterThan(0);
      expect(dagen.filter((d) => d.rijen > 1).every((d) => d.kop)).toBe(true);
    } finally {
      herstel();
    }
  });

  // #912: "Toon meer" schoof de knop naar beneden en zette de nieuwe items
  // eronder, zonder je leespositie mee te nemen — je moest zelf terugzoeken.
  it("verplaatst de focus naar het eerste nieuw geladen item", async () => {
    // Ruim boven FEED_LIMIT (50), elk op een eigen dag en zonder groep, zodat
    // ze niet tot één avondkaart gebundeld worden.
    const veelMatches = Array.from({ length: 60 }, (_, i) => {
      const ts = new Date(Date.UTC(2026, 3, 1) - i * 86_400_000).toISOString();
      return {
        ...MATCH_DONE,
        id: `bulk-${i}`,
        group_id: null,
        round_number: null,
        played_at: ts,
        created_at: ts,
      };
    });
    const herstel = overrideTabellen({ matches: veelMatches });
    try {
      const { container } = renderPage();
      const meer = await screen.findByRole("button", { name: /toon meer/i });

      const voorAantal = container.querySelectorAll(".feed__item").length;
      fireEvent.click(meer);

      const items = container.querySelectorAll(".feed__item");
      expect(items.length).toBeGreaterThan(voorAantal);
      // Het eerste item van de nieuwe lading heeft de focus, niet de body.
      expect(items[voorAantal]).toHaveFocus();
    } finally {
      herstel();
    }
  });

  // #912: "Muisstille feed · Vrienden zoeken" verscheen ook voor wie er al
  // twintig heeft en gewoon een rustige week meemaakt.
  it("stuurt zonder vrienden naar Vrienden, mét vrienden naar Matches", async () => {
    // Een lege feed vraagt om lege matches én groepen; de vriendschapsitems
    // zelf vallen weg via de privacyfilter (niet-vindbare profielen, #59) —
    // precies de situatie "je hébt vrienden, maar er is niets te zien".
    const stil = {
      matches: [],
      groups: [],
      profiles: PROFILES.map((p) =>
        p.id === "p1" ? p : { ...p, discoverable: false },
      ),
    };

    const metVrienden = overrideTabellen(stil);
    try {
      renderPage();
      expect(await screen.findByText(/iedereen zit stil/i)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /uitslag invullen/i }),
      ).toHaveAttribute("href", "/spelen?log=1");
      expect(screen.queryByText(/nog niemand om te volgen/i)).toBeNull();
    } finally {
      metVrienden();
    }

    const zonderVrienden = overrideTabellen({ ...stil, friendships: [] });
    try {
      renderPage();
      expect(
        await screen.findByText(/nog niemand om te volgen/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /vrienden zoeken/i }),
      ).toHaveAttribute("href", "/vrienden");
    } finally {
      zonderVrienden();
    }
  });

  it("linkt een vriendschap door naar het spelersprofiel", async () => {
    renderPage();
    await openVriendschapsbundel();
    const items = await screen.findAllByRole("link", {
      name: /zijn nu vrienden/i,
    });
    expect(items[0]).toHaveAttribute("href", expect.stringContaining("/spelers/"));
  });
});

// De filterrij is een horizontale scroller, en overflow-x maakt hem per spec
// óók verticaal een clippende doos. Stond die padding op nul, dan zat een chip
// van 44px in een clip-box van precies 44px: de focusring (4px buiten de knop)
// en de schaduw van de actieve chip vielen er helemaal af, en op iOS werd de
// bovenkant van de actieve pil plat afgesneden (#1309). jsdom rekent geen
// overflow door, dus de regel die dat bepaalt wordt uit de stylesheet gelezen.
describe("verticale speling in de filterrij (#1309)", () => {
  // Zonder de commentaren te strippen leest een regex de uitleg mee: die noemt
  // de eigenschappen waar het over gaat, en dan matcht de toelichting in plaats
  // van de regel.
  const FEED_CSS = readFileSync("src/features/feed/Feed.css", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const blok = FEED_CSS.slice(
    FEED_CSS.indexOf(".feed__filters {"),
    FEED_CSS.indexOf(".feed__filters[data-schaduw"),
  );

  it("geeft de scroller verticale padding", () => {
    const padding = blok.match(/^\s*padding:\s*([^;]+);/m)?.[1];
    expect(padding).toBeDefined();
    // Horizontaal blijft 0 — de chips moeten tot de rand kunnen schuiven.
    expect(padding).toMatch(/^var\(--sp-2\)\s+0$/);
  });

  it("compenseert die padding met een negatieve marge", () => {
    // Anders wordt de filterbar 16px hoger en verspringt de hele feed.
    expect(blok).toMatch(/margin-block:\s*calc\(var\(--sp-2\) \* -1\)/);
  });
});
