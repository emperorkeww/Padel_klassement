import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { tables } = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { JokerInventaris } from "@/features/profiles/components/JokerInventaris";
import { MATCH_DONE } from "@/test/fixtures";
import type { Match } from "@/types";

const MATCHES = [MATCH_DONE as Match];

/** Maand van vandaag in hetzelfde formaat als period_month. */
function dezeMaand(): string {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-01`;
}

function kaart(over: Record<string, unknown> = {}) {
  return {
    match_id: MATCH_DONE.id,
    player_id: "p1",
    group_id: "g1",
    joker: "schild",
    period_month: dezeMaand(),
    created_at: "2026-08-02T10:00:00.000Z",
    ...over,
  };
}

function setJokers(rows: unknown[]) {
  for (const key of Object.keys(tables)) delete tables[key];
  tables.match_jokers = rows;
}

beforeEach(() => setJokers([]));

describe("<JokerInventaris /> (#1003)", () => {
  it("meldt dat de kaart van deze maand nog klaarligt", async () => {
    render(<JokerInventaris matches={MATCHES} playerId="p1" isMij />);
    expect(await screen.findByText(/je kaart ligt nog klaar/i)).toBeInTheDocument();
  });

  it("toont welke kaart je deze maand speelde", async () => {
    setJokers([kaart()]);
    render(<JokerInventaris matches={MATCHES} playerId="p1" isMij />);
    expect(await screen.findByText(/gespeeld: schild/i)).toBeInTheDocument();
  });

  it("zet oudere maanden in de historie eronder", async () => {
    setJokers([kaart({ period_month: "2026-06-01", joker: "dubbel_of_niets" })]);
    render(<JokerInventaris matches={MATCHES} playerId="p1" isMij />);
    expect(await screen.findByText(/dubbel of niets/i)).toBeInTheDocument();
    // De maand van vandaag is dan nog vrij.
    expect(screen.getByText(/je kaart ligt nog klaar/i)).toBeInTheDocument();
  });

  it("blijft weg op andermans profiel", async () => {
    setJokers([kaart()]);
    render(<JokerInventaris matches={MATCHES} playerId="p2" isMij={false} />);
    await new Promise((r) => setTimeout(r, 0));
    // Andermans nog liggende kaart verklapt wat er aan kan komen.
    expect(screen.queryByText(/je jokers/i)).not.toBeInTheDocument();
  });
});
