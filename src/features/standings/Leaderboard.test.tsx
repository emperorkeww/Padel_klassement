import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { makeSupabaseMock } from "../../test/supabaseMock";
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
    expect(await screen.findByText(/alice anders/i)).toBeInTheDocument();
    expect(await screen.findByText("6")).toBeInTheDocument();
  });
});
