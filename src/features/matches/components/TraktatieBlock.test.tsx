import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});

import { supabase } from "@/lib/supabase/client";
import { TraktatieBlock } from "@/features/matches/components/TraktatieBlock";
import { MATCH_DONE, MATCH_PLANNED, PROFILES } from "@/test/fixtures";
import type { Match, Profile } from "@/types";

const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

// Een geplande match met een starttijd in de verre toekomst: de inzet staat dan
// nog open (spiegel van set_match_wager, dat na de aftrap weigert).
const GEPLAND = {
  ...MATCH_PLANNED,
  played_at: "2030-01-01T19:00:00.000Z",
} as unknown as Match;
const GESPEELD = MATCH_DONE as unknown as Match;

function renderBlok(match: Match, magBeheren = true) {
  return render(
    <ToastProvider>
      <TraktatieBlock
        match={match}
        profiles={pmap}
        magBeheren={magBeheren}
        onSaved={() => {}}
      />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.mocked(supabase.rpc).mockClear();
});

describe("<TraktatieBlock /> (#1004)", () => {
  it("blijft weg als er niets staat en jij er niets aan mag veranderen", () => {
    renderBlok(GEPLAND, false);
    expect(
      screen.queryByRole("region", { name: /drankje-inzet/i }),
    ).not.toBeInTheDocument();
  });

  it("nodigt uit om een drankje op een geplande match te zetten", () => {
    renderBlok(GEPLAND);
    expect(
      screen.getByRole("button", { name: /zet er een drankje op/i }),
    ).toBeInTheDocument();
  });

  it("bewaart een gekozen drankje via set_match_wager", async () => {
    renderBlok(GEPLAND);
    fireEvent.click(screen.getByRole("button", { name: /zet er een drankje op/i }));
    fireEvent.click(screen.getByRole("radio", { name: /duvel/i }));
    fireEvent.click(screen.getByRole("button", { name: /inzet bewaren/i }));
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        "set_match_wager",
        expect.objectContaining({ p_drink: "duvel", p_qty: 1 }),
      ),
    );
  });

  it("verhoogt het aantal per winnaar", async () => {
    renderBlok(GEPLAND);
    fireEvent.click(screen.getByRole("button", { name: /zet er een drankje op/i }));
    fireEvent.click(screen.getByRole("radio", { name: /duvel/i }));
    fireEvent.click(screen.getByRole("button", { name: "Eén meer" }));
    fireEvent.click(screen.getByRole("button", { name: /inzet bewaren/i }));
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        "set_match_wager",
        expect.objectContaining({ p_qty: 2 }),
      ),
    );
  });

  it("toont de inlos-knop na een gewonnen match en vinkt af", async () => {
    renderBlok({ ...GESPEELD, wager_drink: "duvel", wager_drink_qty: 2 });
    fireEvent.click(screen.getByRole("button", { name: /traktatie ingelost/i }));
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        "settle_match_wager",
        expect.objectContaining({ p_match_id: "m-done", p_settled: true }),
      ),
    );
  });

  it("biedt bij gelijkspel niets aan: de inzet vervalt", () => {
    renderBlok({
      ...GESPEELD,
      winner_team_id: null,
      wager_drink: "duvel",
      wager_drink_qty: 1,
    });
    expect(screen.getByText(/inzet vervalt/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /traktatie ingelost/i }),
    ).not.toBeInTheDocument();
  });

  it("kan een afgevinkte traktatie terugdraaien", async () => {
    renderBlok({
      ...GESPEELD,
      wager_drink: "duvel",
      wager_drink_qty: 1,
      wager_settled_at: "2026-08-01T22:00:00.000Z",
      wager_settled_by: "p2",
    });
    expect(screen.getByText(/afgevinkt door bob/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /toch nog niet betaald/i }));
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        "settle_match_wager",
        expect.objectContaining({ p_settled: false }),
      ),
    );
  });

  it("laat een gespeelde match niet meer bijstellen", () => {
    renderBlok({ ...GESPEELD, wager_drink: "duvel" });
    expect(
      screen.queryByRole("button", { name: /inzet wijzigen/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/ligt vast/i)).toBeInTheDocument();
  });
});
