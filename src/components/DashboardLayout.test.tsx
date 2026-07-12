import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import { ToastProvider } from "./ToastProvider";
import type { RatingPoint } from "../lib/types";

vi.mock("../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../test/supabaseMock");
  const { TABLES, SESSION } = await import("../test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

// De tier-aankondiging leest de eigen rating-historie; hier gemockt zodat we
// per test een drempel-kruising kunnen opvoeren zonder de querycache te raken.
vi.mock("../features/standings/ratingsApi", () => ({
  getRatingHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock("../lib/confetti", () => ({ celebrate: vi.fn() }));

import DashboardLayout from "./DashboardLayout";
import { supabase } from "../lib/supabase";
import { getRatingHistory } from "../features/standings/ratingsApi";
import { celebrate } from "../lib/confetti";

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

function renderShell() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<div>pagina-inhoud</div>} />
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

  it("meldt een hoofdtier-promotie met confetti", async () => {
    window.localStorage.setItem("tier-announced:p1", "m-0");
    vi.mocked(getRatingHistory).mockResolvedValue([
      pt("m-0", 1080, 1095),
      pt("m-x", 1095, 1105),
    ]);
    renderShell();
    expect(
      await screen.findByText(/gepromoveerd naar glazenwasser iii/i),
    ).toBeInTheDocument();
    expect(celebrate).toHaveBeenCalled();
    expect(window.localStorage.getItem("tier-announced:p1")).toBe("m-x");
  });

  it("meldt een degradatie sober, zonder confetti", async () => {
    window.localStorage.setItem("tier-announced:p1", "m-0");
    vi.mocked(getRatingHistory).mockResolvedValue([
      pt("m-0", 1098, 1105),
      pt("m-x", 1105, 1095),
    ]);
    renderShell();
    expect(await screen.findByText(/je zakt naar wannabe i/i)).toBeInTheDocument();
    expect(celebrate).not.toHaveBeenCalled();
  });
});
