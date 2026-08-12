import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";
import type { Match, RatingPoint, Team } from "@/types";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

// De tier-aankondiging leest de eigen rating-historie; hier gemockt zodat we
// per test een drempel-kruising kunnen opvoeren zonder de querycache te raken.
// getPlayerRatings hoort erbij sinds de badge-aankondiging (#615) mee mount.
vi.mock("../features/standings/ratingsApi", () => ({
  getRatingHistory: vi.fn().mockResolvedValue([]),
  getPlayerRatings: vi.fn().mockResolvedValue({}),
}));
// De badge-aankondiging (#615) leest de eigen matches; gemockt om per test een
// vers behaalde badge op te voeren zonder de querycache. De streak-/missie-
// hooks delen deze functies en seeden dan gewoon stil mee.
vi.mock("@/features/matches/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/matches/api")>()),
  getPlayerMatches: vi.fn().mockResolvedValue([]),
  getTeamsMap: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/utils/confetti", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/confetti")>()),
  celebrate: vi.fn(),
}));
// Meldingen (#1090): de shell leest de lijst én een aparte count. De query-mock
// levert geen `count`, dus die twee komen hier rechtstreeks uit de api-module.
vi.mock("@/features/meldingen/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/meldingen/api")>()),
  getMeldingen: vi.fn().mockResolvedValue([]),
  getOngelezenAantal: vi.fn().mockResolvedValue(0),
  markeerGelezen: vi.fn().mockResolvedValue(undefined),
  markeerAllesGelezen: vi.fn().mockResolvedValue(undefined),
}));

import DashboardLayout from "@/app/DashboardLayout";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { PLAY_POLL_VOTES, TABLES } from "@/test/fixtures";
import { supabase } from "@/lib/supabase/client";
import { getRatingHistory, getPlayerRatings } from "@/features/standings/ratingsApi";
import { getPlayerMatches, getTeamsMap } from "@/features/matches/api";
import { celebrate } from "@/lib/utils/confetti";
import { getMeldingen, getOngelezenAantal } from "@/features/meldingen/api";

// Node's globale localStorage (zonder --localstorage-file) is een kreupele
// stub die ook window.localStorage overschaduwt; vervang hem door een simpele
// map zodat de aankondigings-flag echt gelezen/geschreven kan worden
// (zelfde aanpak als theme.test.ts).
let store: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  },
});

const pt = (
  matchId: string,
  before: number,
  after: number,
): RatingPoint & { player_id: string } => ({
  player_id: "p1",
  match_id: matchId,
  rating_before: before,
  rating_after: after,
  delta: after - before,
  played_at: "2026-07-02T10:00:00.000Z",
});

function renderShell(pad = "/") {
  return render(
    <MemoryRouter initialEntries={[pad]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<div>pagina-inhoud</div>} />
              <Route path="/groepen/:id" element={<div>pagina-inhoud</div>} />
              <Route path="/matches/:id" element={<div>pagina-inhoud</div>} />
              {/* #1211: de landing van "Ik" en de instellingen ernaast. */}
              <Route path="/spelers/:id" element={<div>pagina-inhoud</div>} />
              <Route path="/profiel" element={<div>pagina-inhoud</div>} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  store = {};
  vi.mocked(getRatingHistory).mockReset().mockResolvedValue([]);
  vi.mocked(getPlayerRatings).mockReset().mockResolvedValue({});
  vi.mocked(getPlayerMatches).mockReset().mockResolvedValue([]);
  vi.mocked(getTeamsMap).mockReset().mockResolvedValue({});
  vi.mocked(celebrate).mockClear();
  vi.mocked(getMeldingen).mockReset().mockResolvedValue([]);
  vi.mocked(getOngelezenAantal).mockReset().mockResolvedValue(0);
});

describe("<DashboardLayout />", () => {
  it("toont de gegroepeerde zijbalk, onderbalk en de pagina-inhoud", async () => {
    renderShell();
    expect(await screen.findByText("pagina-inhoud")).toBeInTheDocument();
    for (const groep of ["Competitie", "Ik"]) {
      expect(screen.getAllByText(groep).length).toBeGreaterThan(0);
    }
    // Zijbalk + mobiele onderbalk samen: links naar de hoofdonderdelen.
    expect(screen.getAllByRole("link", { name: /klassement/i }).length).toBe(2);
    expect(screen.getAllByRole("link", { name: /^spelen$/i }).length).toBe(2);
    // #69: "Ik" (profiel) zit nu in de mobiele balk; Vrienden in de zijbalk.
    expect(screen.getAllByRole("link", { name: /^ik$/i }).length).toBeGreaterThan(0);
    // #1123: Matches is opgegaan in Spelen en heeft geen eigen ingang meer.
    expect(screen.queryAllByRole("link", { name: /^matches$/i }).length).toBe(0);
    // De vrijgekomen mobiele tab gaat naar de Agenda, die tot dan als losse
    // knop in de topbalk hing: nu zijbalk + onderbalk, net als de rest.
    expect(screen.getAllByRole("link", { name: /^agenda$/i }).length).toBe(2);
    // #274: Vrienden schuift naar de zijbalk (niet meer in de onderbalk).
    expect(
      screen.getAllByRole("link", { name: /vrienden/i }).length,
    ).toBe(1);
    // Feed (#120): zijbalk + mobiele onderbalk; Banen alleen nog in de zijbalk.
    expect(screen.getAllByRole("link", { name: /^clubblad$/i }).length).toBe(2);
    expect(screen.getAllByRole("link", { name: /banen/i }).length).toBe(1);
    expect(
      screen.getAllByRole("link", { name: /naar overzicht/i }).length,
    ).toBeGreaterThan(0);
    // Gebruikersblok in de zijbalkvoet.
    expect(await screen.findByText(/alice anders/i)).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  // #910: "actief" werd half door NavLink en half door matchPaths bepaald,
  // waardoor een groepsdetail "Spelen" wél kleurde maar geen aria-current
  // kreeg — een screenreader hoorde die sectie-match dus niet.
  it("markeert Spelen met aria-current op een groepsdetail-pad", async () => {
    renderShell("/groepen/g1");
    await screen.findByText("pagina-inhoud");
    for (const link of screen.getAllByRole("link", { name: /^spelen$/i })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
    // Andere secties blijven ongemarkeerd.
    for (const link of screen.getAllByRole("link", { name: /^clubblad$/i })) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  // #1123: een matchdetail hoort bij Spelen, want daar staan de matches. Zonder
  // "/matches" in matchPaths zou de balk op zo'n pagina helemaal leeg staan.
  it("markeert Spelen ook op een matchdetail-pad", async () => {
    renderShell("/matches/m1");
    await screen.findByText("pagina-inhoud");
    for (const link of screen.getAllByRole("link", { name: /^spelen$/i })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  // #1211: "Ik" beloofde identiteit en leverde een wachtwoordveld. De tab en
  // de avatars landen nu op de eigen spelerskaart; de instellingen blijven
  // dezelfde sectie, maar zijn niet meer de landing.
  it("laat 'Ik' en de avatars op het eigen spelersprofiel landen", async () => {
    renderShell();
    await screen.findByText("pagina-inhoud");

    for (const link of screen.getAllByRole("link", { name: /^ik$/i })) {
      expect(link).toHaveAttribute("href", "/spelers/p1");
    }
    expect(
      screen.getByRole("link", { name: /naar mijn profiel/i }),
    ).toHaveAttribute("href", "/spelers/p1");
    // De zijbalkvoet (naam + e-mail) wijst naar dezelfde plek.
    expect(
      screen.getByText("alice@example.com").closest("a"),
    ).toHaveAttribute("href", "/spelers/p1");
  });

  it("houdt 'Ik' actief op de instellingenpagina", async () => {
    renderShell("/profiel");
    for (const link of await screen.findAllByRole("link", { name: /^ik$/i })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("markeert 'Ik' niet op het profiel van iemand anders", async () => {
    renderShell("/spelers/p2");
    for (const link of await screen.findAllByRole("link", { name: /^ik$/i })) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("markeert alleen het overzicht op /", async () => {
    renderShell("/");
    await screen.findByText("pagina-inhoud");
    for (const link of screen.getAllByRole("link", { name: /^overzicht$/i })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
    for (const link of screen.getAllByRole("link", { name: /^spelen$/i })) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("logt uit via de zijbalk", async () => {
    renderShell();
    await userEvent.click(
      await screen.findByRole("button", { name: /uitloggen/i }),
    );
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});

// De uitlegpagina (#989) is waardeloos zonder een ingang die overal zichtbaar
// is: een ?-knop in de mobiele topbalk en een zijbalk-item op desktop. Beide
// zitten in de shell, dus beide staan in de DOM ongeacht de viewport.
describe("snelkoppeling naar de uitleg (#989)", () => {
  it("staat op élk scherm in de shell, mobiel én desktop", async () => {
    renderShell("/groepen/g1");
    await screen.findByText("pagina-inhoud");
    const ingangen = screen.getAllByRole("link", { name: /hoe werkt het/i });
    // De ?-knop uit de topbalk plus het zijbalk-item.
    expect(ingangen).toHaveLength(2);
  });

  it("springt naar de sectie van het scherm waar je nú staat", async () => {
    renderShell("/groepen/g1");
    await screen.findByText("pagina-inhoud");
    const knop = screen
      .getAllByRole("link", { name: /hoe werkt het/i })
      .find((el) => el.classList.contains("help-knop"));
    // Op een groepspagina hoort de sectie over het organiseren van een speeldag.
    expect(knop).toHaveAttribute("href", "/uitleg#speeldag");
  });

  it("laat de zijbalk-ingang gewoon naar de bovenkant van de pagina wijzen", async () => {
    renderShell("/groepen/g1");
    await screen.findByText("pagina-inhoud");
    const zijbalk = screen
      .getAllByRole("link", { name: /hoe werkt het/i })
      .find((el) => el.classList.contains("sidebar__link"));
    expect(zijbalk).toHaveAttribute("href", "/uitleg");
  });
});

// Meldingen (#1090). Net als de uitleg-ingang uit #989 zit dit in de shell en
// dus in de DOM ongeacht de viewport: de bel in de mobiele topbalk, dezelfde
// ingang als zijbalkregel op desktop — één paneel voor allebei.
describe("meldingen-ingang (#1090)", () => {
  const ingangen = () => screen.getAllByRole("button", { name: /^meldingen/i });

  it("staat op élk scherm in de shell, mobiel én desktop", async () => {
    renderShell();
    await screen.findByText("pagina-inhoud");
    // De bel uit de topbalk plus de zijbalkregel.
    expect(ingangen()).toHaveLength(2);
    expect(
      ingangen().some((el) => el.classList.contains("bel-knop")),
    ).toBe(true);
    expect(
      ingangen().some((el) => el.classList.contains("sidebar__link")),
    ).toBe(true);
  });

  it("zet het aantal ongelezen voluit in de naam, niet alleen als cijfer", async () => {
    vi.mocked(getOngelezenAantal).mockResolvedValue(3);
    renderShell();
    await screen.findByText("pagina-inhoud");
    await vi.waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "Meldingen, 3 ongelezen meldingen" }),
      ).toHaveLength(2),
    );
  });

  it("kapt de zichtbare teller af op 9+ maar niet de naam", async () => {
    vi.mocked(getOngelezenAantal).mockResolvedValue(23);
    renderShell();
    await screen.findByText("pagina-inhoud");
    await vi.waitFor(() =>
      expect(screen.getAllByText("9+").length).toBe(2),
    );
    expect(
      screen.getAllByRole("button", { name: "Meldingen, 23 ongelezen meldingen" }),
    ).toHaveLength(2);
  });

  it("toont geen teller zolang het aantal nog niet bekend is", async () => {
    // Nooit oplossende belofte: de shell hoort dan géén 0-badge te tonen die
    // een tel later naar 3 springt.
    vi.mocked(getOngelezenAantal).mockReturnValue(new Promise(() => {}));
    const { container } = renderShell();
    await screen.findByText("pagina-inhoud");
    expect(container.querySelector(".bel-knop__teller")).toBeNull();
    expect(container.querySelector(".sidebar__teller")).toBeNull();
  });

  it("opent hetzelfde paneel vanuit beide ingangen", async () => {
    vi.mocked(getMeldingen).mockResolvedValue([
      {
        id: "n1",
        soort: "uitslag",
        title: "Uitslag ingevoerd",
        body: "Jullie wonnen.",
        url: "/matches/m1",
        tag: "uitslag-m1",
        created_at: new Date().toISOString(),
        read_at: null,
      },
    ]);
    renderShell();
    await screen.findByText("pagina-inhoud");

    for (const klasse of ["bel-knop", "sidebar__link"]) {
      const ingang = ingangen().find((el) => el.classList.contains(klasse))!;
      await userEvent.click(ingang);
      expect(
        await screen.findByRole("dialog", { name: "Meldingen" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Uitslag ingevoerd")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Sluiten" }));
      await vi.waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Meldingen" })).toBeNull(),
      );
    }
  });
});

// Zolang het profiel laadt is de naam in de zijbalk het e-mailadres, en dan
// stond datzelfde adres er twee keer — als naam én als ondertitel (#949).
describe("zijbalk-identiteit (#949)", () => {
  it("toont het e-mailadres niet twee keer", async () => {
    const { container } = renderShell();
    await screen.findByText("pagina-inhoud");
    const mailregels = container.querySelectorAll(".sidebar__user-mail");
    const naam = container.querySelector(".sidebar__user-name")?.textContent;
    // Ofwel het profiel is er (naam + mail), ofwel nog niet (alleen de mail
    // als naam) — maar nooit dezelfde tekst op beide regels.
    for (const regel of mailregels)
      expect(regel.textContent).not.toBe(naam);
  });
});

describe("tier-aankondiging (#127)", () => {
  it("seedt bij het eerste bezoek zonder historische toasts", async () => {
    vi.mocked(getRatingHistory).mockResolvedValue([
      pt("m-0", 1000, 1005),
      pt("m-done", 1005, 1012),
    ]);
    renderShell();
    await screen.findByText("pagina-inhoud");
    await vi.waitFor(() =>
      expect(window.localStorage.getItem("tier-announced:p1")).toBe("m-done"),
    );
    expect(screen.queryByText(/gepromoveerd/i)).not.toBeInTheDocument();
  });

  it("zwijgt als de nieuwe match geen tier-wissel oplevert", async () => {
    window.localStorage.setItem("tier-announced:p1", "m-0");
    vi.mocked(getRatingHistory).mockResolvedValue([
      pt("m-0", 1000, 1005),
      pt("m-done", 1005, 1012),
    ]);
    renderShell();
    await screen.findByText("pagina-inhoud");
    await vi.waitFor(() =>
      expect(window.localStorage.getItem("tier-announced:p1")).toBe("m-done"),
    );
    expect(screen.queryByText(/gepromoveerd|je zakt/i)).not.toBeInTheDocument();
  });

  it("viert een hoofdtier-promotie als pack-opening (#500)", async () => {
    window.localStorage.setItem("tier-announced:p1", "m-0");
    vi.mocked(getRatingHistory).mockResolvedValue([
      pt("m-0", 1080, 1095),
      pt("m-x", 1095, 1105),
    ]);
    renderShell();
    // Geen toast meer: er verschijnt een dicht pack; confetti pas bij het
    // openscheuren zelf.
    const openKnop = await screen.findByRole("button", {
      name: "Open het pack",
    });
    expect(celebrate).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("tier-announced:p1")).toBe("m-x");

    await userEvent.click(openKnop);
    expect(celebrate).toHaveBeenCalled();
    // De kaart springt eruit met de nieuwe divisie; Rudy's quip is seeded
    // (#299), dus we toetsen op het deterministische tier-label erin.
    expect(
      await screen.findByText(/Promotie! Wannabe → Glazenwasser/, undefined, {
        timeout: 3000,
      }),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/glazenwasser iii\b/i)).length,
    ).toBeGreaterThan(0);

    // Verder sluit het overlay weer.
    await userEvent.click(screen.getByRole("button", { name: "Verder" }));
    expect(
      screen.queryByRole("dialog", { name: /promotie/i }),
    ).not.toBeInTheDocument();
  });

  it("meldt een degradatie sober, zonder confetti", async () => {
    window.localStorage.setItem("tier-announced:p1", "m-0");
    vi.mocked(getRatingHistory).mockResolvedValue([
      pt("m-0", 1098, 1105),
      pt("m-x", 1105, 1095),
    ]);
    renderShell();
    // Seeded degradatie-quip (#299); toets op het deterministische tier-label.
    expect(await screen.findByText(/wannabe i\b/i)).toBeInTheDocument();
    expect(celebrate).not.toHaveBeenCalled();
  });
});

// ── Zeldzame badge (#615) ───────────────────────────────────────────────────

const badgeTeams: Record<string, Team> = {
  tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
};

let matchSeq = 0;
function uitslag(winner: "tA" | "tB"): Match {
  matchSeq += 1;
  const ts = new Date(Date.UTC(2026, 5, 1) + matchSeq * 60_000).toISOString();
  return {
    id: `bm${matchSeq}`,
    team_a_id: "tA",
    team_b_id: "tB",
    status: "completed",
    winner_team_id: winner,
    played_at: ts,
    created_by: null,
    created_at: ts,
    group_id: null,
    round_number: null,
    score_a: null,
    score_b: null,
    format: "2v2",
  };
}

/** 3 verliezen + winst: p1 behaalt de zeldzame Comebackkoning (en o.a. de
 *  niet-zeldzame Eerste overwinning). */
const comebackMatches = () => [
  uitslag("tB"),
  uitslag("tB"),
  uitslag("tB"),
  uitslag("tA"),
];

const geseed = (ids: string[]) =>
  window.localStorage.setItem("badges-announced:p1", JSON.stringify(ids));
const badgeSet = (): string[] =>
  JSON.parse(window.localStorage.getItem("badges-announced:p1") ?? "[]");

describe("zeldzame badge (#615)", () => {
  it("seedt bij het eerste bezoek de behaalde ids zonder pack", async () => {
    vi.mocked(getPlayerMatches).mockResolvedValue(comebackMatches());
    vi.mocked(getTeamsMap).mockResolvedValue(badgeTeams);
    renderShell();
    await screen.findByText("pagina-inhoud");
    await vi.waitFor(() =>
      expect(badgeSet()).toContain("comebackkoning"),
    );
    expect(badgeSet()).toContain("eerste-overwinning");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("viert een vers behaalde zeldzame badge als paars pack", async () => {
    geseed(["eerste-overwinning"]);
    vi.mocked(getPlayerMatches).mockResolvedValue(comebackMatches());
    vi.mocked(getTeamsMap).mockResolvedValue(badgeTeams);
    renderShell();

    const dialog = await screen.findByRole("dialog", {
      name: "Zeldzame badge: Comebackkoning",
    });
    expect(dialog).toHaveClass("pack-opening--badge");
    expect(badgeSet()).toContain("comebackkoning");
    expect(celebrate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Open het pack" }));
    expect(celebrate).toHaveBeenCalled();
    expect(
      await screen.findByText(/Zeldzame badge · 👑 Comebackkoning/, undefined, {
        timeout: 3000,
      }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Verder" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("zwijgt bij een nieuwe niet-zeldzame badge maar noteert hem wel", async () => {
    geseed([]);
    vi.mocked(getPlayerMatches).mockResolvedValue([uitslag("tA")]);
    vi.mocked(getTeamsMap).mockResolvedValue(badgeTeams);
    renderShell();
    await screen.findByText("pagina-inhoud");
    await vi.waitFor(() =>
      expect(badgeSet()).toContain("eerste-overwinning"),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("viert een al aangekondigde badge niet opnieuw (dedup overleeft reload)", async () => {
    geseed(["eerste-overwinning", "comebackkoning"]);
    vi.mocked(getPlayerMatches).mockResolvedValue(comebackMatches());
    vi.mocked(getTeamsMap).mockResolvedValue(badgeTeams);
    renderShell();
    await screen.findByText("pagina-inhoud");
    // De data is verwerkt zodra de set opnieuw is weggeschreven.
    await vi.waitFor(() => expect(badgeSet()).toContain("comebackkoning"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("queuet achter een tier-promotie: eerst goud, na Verder paars", async () => {
    window.localStorage.setItem("tier-announced:p1", "m-0");
    geseed(["eerste-overwinning"]);
    vi.mocked(getRatingHistory).mockResolvedValue([
      pt("m-0", 1080, 1095),
      pt("m-x", 1095, 1105),
    ]);
    vi.mocked(getPlayerMatches).mockResolvedValue(comebackMatches());
    vi.mocked(getTeamsMap).mockResolvedValue(badgeTeams);
    renderShell();

    // Eerst het gouden promotie-pack.
    const goud = await screen.findByRole("dialog", { name: /promotie naar/i });
    expect(goud).not.toHaveClass("pack-opening--badge");
    await userEvent.click(screen.getByRole("button", { name: "Open het pack" }));
    await screen.findByText(/Promotie! Wannabe → Glazenwasser/, undefined, {
      timeout: 3000,
    });
    await userEvent.click(screen.getByRole("button", { name: "Verder" }));

    // Meteen daarna het paarse badge-pack, opnieuw dicht.
    const paars = await screen.findByRole("dialog", {
      name: "Zeldzame badge: Comebackkoning",
    });
    expect(paars).toHaveClass("pack-opening--badge");
    expect(
      screen.getByRole("button", { name: "Open het pack" }),
    ).toBeInTheDocument();
  });
});

describe("attentiestippen op de balk (#1214)", () => {
  // De bel telde meldingen, de balk zelf was stil: wie de app opende op
  // Klassement zag niet dat er een stem of een uitslag op hem wachtte.

  it("houdt de balk stil als er niets op je wacht", async () => {
    renderShell();
    await screen.findByText("pagina-inhoud");
    // Alice stemde al op de enige lopende poll en heeft geen openstaande
    // uitslag (getPlayerMatches is hier leeg).
    for (const naam of [/^agenda$/i, /^spelen$/i]) {
      for (const link of screen.getAllByRole("link", { name: naam })) {
        expect(link.querySelector(".nav-stip")).toBeNull();
      }
    }
  });

  it("zet een stip op Agenda zolang jouw stem uitstaat", async () => {
    TABLES.play_poll_votes = PLAY_POLL_VOTES.filter((v) => v.player_id !== "p1");
    invalidateAll();
    try {
      renderShell();
      // De naam draagt de betekenis; de stip is er de zichtbare helft van.
      const links = await screen.findAllByRole("link", {
        name: /agenda — er wacht een speeldag op je/i,
      });
      expect(links.length).toBeGreaterThan(0);
      expect(links[0].querySelector(".nav-stip")).not.toBeNull();
      // Spelen blijft stil: dat is een ander signaal.
      expect(
        screen.queryAllByRole("link", { name: /spelen —/i }),
      ).toHaveLength(0);
    } finally {
      TABLES.play_poll_votes = PLAY_POLL_VOTES;
      invalidateAll();
    }
  });

  it("zet een stip op Spelen zodra een uitslag op je wacht", async () => {
    vi.mocked(getPlayerMatches).mockResolvedValue([
      {
        id: "m-oud",
        team_a_id: "t-ab",
        team_b_id: "t-cd",
        status: "scheduled",
        winner_team_id: null,
        score_a: null,
        score_b: null,
        played_at: "2020-01-01T19:00:00.000Z",
        created_at: "2020-01-01T10:00:00.000Z",
        created_by: "p1",
        group_id: "g1",
        round_number: 1,
        format: "2v2",
      } as unknown as Match,
    ]);
    invalidateAll();
    try {
      renderShell();
      const links = await screen.findAllByRole("link", {
        name: /spelen — er wacht een uitslag op je/i,
      });
      expect(links[0].querySelector(".nav-stip")).not.toBeNull();
    } finally {
      invalidateAll();
    }
  });
});
