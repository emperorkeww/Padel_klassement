import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// #1271 — de scherpste val van de speeldag-doorloop.
//
// Een geplande match draagt zijn *speeltijd* in `played_at`; er is geen aparte
// scheduled_at-kolom. Zette het invulpad die op nu, dan verschoof de match bij
// het invullen naar een andere kalenderdag en verdween hij van zijn eigen
// speeldagpagina (matchesVoorSpeeldag filtert op die dag). Wie de laatste ronde
// van gisteravond vanochtend invulde, raakte hem dus kwijt — inclusief de
// per-ronde starttijden uit #827.
//
// Deze suite bewaakt dat de kaart het geplande tijdstip meestuurt.

const GISTERAVOND = "2026-08-12T18:00:00.000Z";

const beheer = vi.hoisted(() => ({
  vulUitslagIn: vi.fn<(params: Record<string, unknown>, alsBeheerder: boolean) => Promise<void>>(
    async () => {},
  ),
  verzetTijdstip: vi.fn(async () => {}),
  verwijderMatchSlim: vi.fn(async () => {}),
  slaCorrectieOp: vi.fn(async () => {}),
}));

const { tables } = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/features/admin/matchBeheer", () => beheer);

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

function renderCard(match: Match) {
  for (const key of Object.keys(tables)) delete tables[key];
  Object.assign(tables, {
    ...TABLES,
    matches: [match],
    match_stakes: [],
    active_bounties: [],
  });
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <PlannedMatchCard match={match} teams={tmap} profiles={pmap} />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Opent de sheet, vult 6-3 in en slaat op. */
async function vulUitslagInViaKaart() {
  await openScoreSheets();
  const velden = await screen.findAllByRole("spinbutton");
  await userEvent.type(velden[0]!, "6");
  await userEvent.type(velden[1]!, "3");
  await userEvent.click(
    await screen.findByRole("button", { name: /uitslag opslaan/i }),
  );
}

describe("<PlannedMatchCard /> speeltijd (#1271)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stuurt de geplande speeltijd mee bij het invullen", async () => {
    renderCard({ ...MATCH_PLANNED, played_at: GISTERAVOND } as Match);
    await vulUitslagInViaKaart();

    expect(beheer.vulUitslagIn).toHaveBeenCalledWith(
      expect.objectContaining({ playedAt: GISTERAVOND }),
      expect.anything(),
    );
  });

  it("laat een match zónder tijdstip terugvallen op nu", async () => {
    // Zonder played_at is er niets te bewaren: created_at is het moment van
    // klaarzetten, niet van spelen. De api-laag zet dan zelf now().
    renderCard({ ...MATCH_PLANNED, played_at: null } as Match);
    await vulUitslagInViaKaart();

    expect(beheer.vulUitslagIn).toHaveBeenCalledWith(
      expect.objectContaining({ playedAt: null }),
      expect.anything(),
    );
  });
});
