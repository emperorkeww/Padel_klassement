import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { tables } = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { JokerKnop } from "@/features/matches/components/JokerKnop";
import { MIN_GAMES } from "@/features/matches/stakes";

function setTables(rows: Record<string, unknown[]>) {
  for (const key of Object.keys(tables)) delete tables[key];
  Object.assign(tables, rows);
}

function renderKnop(myId: string | null = "p1") {
  return render(
    <MemoryRouter>
      <JokerKnop myId={myId} />
    </MemoryRouter>,
  );
}

const INGELOPEN = [{ player_id: "p1", rating: 1100, games: MIN_GAMES }];

beforeEach(() => setTables({ match_jokers: [], player_ratings: INGELOPEN }));

// De knop staat in de app-shell en is dus op élk scherm de enige plek waar je
// je voorraad ziet; daarom draagt het label de status voluit en niet alleen de
// kleur (#1003).
describe("<JokerKnop /> (#1003)", () => {
  it("toont een klaarliggende kaart", async () => {
    renderKnop();
    expect(await screen.findByRole("link", { name: /ligt klaar/i })).toHaveAttribute(
      "href",
      "/profiel#jokers",
    );
  });

  it("toont een gespeelde kaart als gespeeld", async () => {
    setTables({
      match_jokers: [
        {
          match_id: "m1",
          player_id: "p1",
          group_id: "g1",
          joker: "schild",
          period_month: "2026-08-01",
          created_at: "2026-08-02T10:00:00.000Z",
        },
      ],
      player_ratings: INGELOPEN,
    });
    renderKnop();
    // De status staat voluit in het label, niet alleen in de kleur.
    expect(
      await screen.findByRole("link", { name: /is gespeeld/i }),
    ).toBeInTheDocument();
  });

  it("legt uit waarom er nog een slot op zit bij een niet ingelopen rating", async () => {
    setTables({
      match_jokers: [],
      player_ratings: [{ player_id: "p1", rating: 1000, games: 2 }],
    });
    renderKnop();
    expect(
      await screen.findByRole("link", { name: /alleen van kant wisselen/i }),
    ).toBeInTheDocument();
  });

  it("blijft weg zonder ingelogde speler", async () => {
    renderKnop(null);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
