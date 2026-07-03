import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { makeSupabaseMock } from "../../test/supabaseMock";
import { PLAYER_RATINGS, RATING_HISTORY } from "../../test/fixtures";
import { AuthProvider } from "../auth/AuthProvider";

vi.mock("../../lib/supabase", () => ({
  supabase: makeSupabaseMock({
    session: { user: { id: "p1", email: "alice@example.com" } },
    tables: {
      player_standings: [
        {
          player_id: "p1",
          username: "alice",
          full_name: "Alice Anders",
          played: 2,
          won: 2,
          lost: 0,
          points: 6,
        },
      ],
      standings: [],
      groups: [],
      player_ratings: PLAYER_RATINGS,
      rating_history: RATING_HISTORY,
    },
  }),
}));

import Leaderboard from "./Leaderboard";

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Leaderboard />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<Leaderboard />", () => {
  it("toont de titel en een spelerrij", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /klassement/i }),
    ).toBeInTheDocument();
    // Naam en punten staan zowel in de desktop-tabel als in de mobiele
    // ranglijst (CSS toont er één van de twee).
    expect((await screen.findAllByText(/alice anders/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("6")).length).toBeGreaterThan(0);
  });

  it("toont een sparkline met het ratingverloop van de speler", async () => {
    renderPage();
    expect(
      await screen.findByRole("img", {
        name: "Ratingverloop van Alice Anders",
      }),
    ).toBeInTheDocument();
  });
});
