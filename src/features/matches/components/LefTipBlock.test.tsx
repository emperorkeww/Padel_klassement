import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/ui/ToastProvider";

const { tables } = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { LefTipBlock } from "@/features/matches/components/LefTipBlock";
import { MATCH_DONE, PROFILES } from "@/test/fixtures";
import type { Match, Profile } from "@/types";

const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

const STAKE = {
  match_id: MATCH_DONE.id,
  player_id: "p2",
  group_id: "g1",
  play_date: "2026-07-02",
  created_at: "2026-07-02T10:00:00.000Z",
};

function setStakes(rows: unknown[]) {
  for (const key of Object.keys(tables)) delete tables[key];
  tables.match_stakes = rows;
}

function renderBlok(match: Match = MATCH_DONE as Match) {
  return render(
    <ToastProvider>
      <LefTipBlock
        match={match}
        profiles={pmap}
        myId="p1"
        isDeelnemer
        mijnKans={null}
        games={0}
      />
    </ToastProvider>,
  );
}

beforeEach(() => setStakes([]));

describe("<LefTipBlock /> op een afgeronde match", () => {
  it("onthult wie er dubbel of niets speelde", async () => {
    setStakes([STAKE]);
    renderBlok();
    // Open tegel (geen accordeon meer): de onthulling staat er direct.
    expect(
      await screen.findByText(/lef getoond door bob/i),
    ).toBeInTheDocument();
  });

  it("toont geen knop meer om in te zetten", async () => {
    setStakes([STAKE]);
    renderBlok();
    await screen.findByText(/lef getoond door bob/i);
    // Uitgegrijsde knop zou suggereren dat het nog kan; die hoort weg te zijn.
    expect(
      screen.queryByRole("button", { name: /zet je lef in/i }),
    ).not.toBeInTheDocument();
  });

  it("blijft weg als niemand ingezet had", async () => {
    renderBlok();
    // Even wachten tot de (lege) inzetten geladen zijn, anders bewijst de
    // assertie alleen dat het blok nog niet gerenderd wás.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/🎲 lef/i)).not.toBeInTheDocument();
  });
});
