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
import { MATCH_DONE, MATCH_PLANNED, PROFILES } from "@/test/fixtures";
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

function renderBlok(
  match: Match = MATCH_DONE as Match,
  props: { isDeelnemer?: boolean; games?: number } = {},
) {
  return render(
    <ToastProvider>
      <LefTipBlock
        match={match}
        profiles={pmap}
        myId="p1"
        isDeelnemer={props.isDeelnemer ?? true}
        mijnKans={null}
        games={props.games ?? 0}
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

// De onthulling hoort aan de aftrap te hangen, niet aan de vraag of jíj nog
// mag inzetten: anders lekt elke geblokkeerde kijker andermans inzet vooraf.
describe("<LefTipBlock /> vóór de aftrap", () => {
  const GEPLAND = {
    ...MATCH_PLANNED,
    played_at: new Date(Date.now() + 3600_000).toISOString(),
  } as Match;
  const STAKE_GEPLAND = { ...STAKE, match_id: GEPLAND.id };

  it("verklapt andermans inzet niet aan wie zelf niet meespeelt", async () => {
    setStakes([STAKE_GEPLAND]);
    renderBlok(GEPLAND, { isDeelnemer: false, games: 12 });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/lef getoond door bob/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/🎲 lef/i)).not.toBeInTheDocument();
  });

  it("verklapt andermans inzet niet aan een deelnemer die nog niet mag", async () => {
    setStakes([STAKE_GEPLAND]);
    // Te weinig gespeelde matches: wel het blok met de uitleg, geen namen.
    renderBlok(GEPLAND, { games: 3 });
    await screen.findByText(/🎲 lef/i);
    expect(screen.queryByText(/lef getoond door bob/i)).not.toBeInTheDocument();
  });
});
