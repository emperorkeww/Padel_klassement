import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { makeSupabaseMock } from "../../test/supabaseMock";
import { AuthProvider } from "../auth/AuthProvider";

vi.mock("../../lib/supabase", () => ({
  supabase: makeSupabaseMock({
    session: { user: { id: "p1", email: "alice@example.com" } },
    tables: {
      profiles: [{ id: "p2", username: "bob", full_name: "Bob Boers" }],
      player_standings: [
        {
          player_id: "p2",
          username: "bob",
          full_name: "Bob Boers",
          played: 3,
          won: 2,
          lost: 1,
          points: 6,
        },
      ],
      teams: [],
      matches: [],
    },
  }),
}));

import PlayerProfile from "./PlayerProfile";

describe("<PlayerProfile />", () => {
  it("toont naam en statistieken van de speler", async () => {
    render(
      <MemoryRouter initialEntries={["/spelers/p2"]}>
        <AuthProvider>
          <Routes>
            <Route path="/spelers/:id" element={<PlayerProfile />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/bob boers/i)).toBeInTheDocument();
    expect(await screen.findByText("6")).toBeInTheDocument();
  });
});
