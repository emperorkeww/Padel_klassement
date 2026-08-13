import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// #1271 — na het opslaan bood de kaart niets meer.
//
// `save()` zet `saved` en dan `if (saved) return`: de kaart klapt om naar
// "opgeslagen ✓" en daar houdt het op. Een typfout rechtzetten betekende: naar
// /matches/:id, dan ⋯, dan "Score corrigeren". Op de avond zelf, met natte
// handen, is dat de verkeerde kant op.

const beheer = vi.hoisted(() => ({
  vulUitslagIn: vi.fn(async () => {}),
  slaCorrectieOp: vi.fn(async () => {}),
  verzetTijdstip: vi.fn(async () => {}),
  verwijderMatchSlim: vi.fn(async () => {}),
}));
vi.mock("@/features/admin/matchBeheer", () => beheer);

const { tables } = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]> }));
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { MATCH_PLANNED, PROFILES, TABLES, TEAMS } from "@/test/fixtures";
import { openScoreSheets } from "@/test/plannedCard";
import type { Match, Profile, Team } from "@/types";

const tmap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<string, Team>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

const GEPLAND = {
  ...MATCH_PLANNED,
  played_at: "2026-09-04T18:00:00.000Z",
} as Match;

function toon() {
  for (const key of Object.keys(tables)) delete tables[key];
  Object.assign(tables, { ...TABLES, matches: [GEPLAND], match_stakes: [], active_bounties: [] });
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <PlannedMatchCard match={GEPLAND} teams={tmap} profiles={pmap} />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Vult 6-3 in via de sheet en slaat op. */
async function vulIn() {
  await openScoreSheets();
  const velden = await screen.findAllByRole("spinbutton");
  await userEvent.type(velden[0]!, "6");
  await userEvent.type(velden[1]!, "3");
  await userEvent.click(
    await screen.findByRole("button", { name: /uitslag opslaan/i }),
  );
}

describe("<PlannedMatchCard /> corrigeren (#1271)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("biedt na het opslaan een weg terug naar de score", async () => {
    toon();
    await vulIn();
    expect(
      await screen.findByRole("button", { name: /score corrigeren/i }),
    ).toBeInTheDocument();
  });

  it("schrijft de correctie weg langs het correctiepad", async () => {
    // Niet via vulUitslagIn: dat is voor een match die nog geen uitslag heeft,
    // en het zou `played_at` opnieuw ter discussie stellen.
    toon();
    await vulIn();
    await userEvent.click(
      await screen.findByRole("button", { name: /score corrigeren/i }),
    );
    const velden = await screen.findAllByRole("spinbutton");
    await userEvent.clear(velden[1]!);
    await userEvent.type(velden[1]!, "4");
    await userEvent.click(
      await screen.findByRole("button", { name: /score opslaan/i }),
    );

    expect(beheer.slaCorrectieOp).toHaveBeenCalledWith(
      expect.objectContaining({ scoreA: 6, scoreB: 4 }),
      expect.anything(),
    );
  });

  it("start de correctie met de stand die er staat", async () => {
    toon();
    await vulIn();
    await userEvent.click(
      await screen.findByRole("button", { name: /score corrigeren/i }),
    );
    const velden = await screen.findAllByRole("spinbutton");
    expect(velden[0]).toHaveValue(6);
    expect(velden[1]).toHaveValue(3);
  });
});
