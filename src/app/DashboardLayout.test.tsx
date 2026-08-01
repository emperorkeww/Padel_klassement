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

import DashboardLayout from "@/app/DashboardLayout";
import { supabase } from "@/lib/supabase/client";
import { getRatingHistory, getPlayerRatings } from "@/features/standings/ratingsApi";
import { getPlayerMatches, getTeamsMap } from "@/features/matches/api";
import { celebrate } from "@/lib/utils/confetti";

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
    // #274: Matches is nu een vaste mobiele tab (zijbalk + onderbalk).
    expect(screen.getAllByRole("link", { name: /^matches$/i }).length).toBe(2);
    // #274: Vrienden schuift naar de zijbalk (niet meer in de onderbalk).
    expect(
      screen.getAllByRole("link", { name: /vrienden/i }).length,
    ).toBe(1);
    // Feed (#120): zijbalk + mobiele onderbalk; Banen alleen nog in de zijbalk.
    expect(screen.getAllByRole("link", { name: /^feed$/i }).length).toBe(2);
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
    for (const link of screen.getAllByRole("link", { name: /^feed$/i })) {
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
