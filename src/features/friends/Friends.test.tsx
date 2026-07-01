import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { makeSupabaseMock } from "../../test/supabaseMock";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

vi.mock("../../lib/supabase", () => ({
  supabase: makeSupabaseMock({
    session: { user: { id: "p1", email: "alice@example.com" } },
    tables: {
      friendships: [
        { id: "f1", requester_id: "p2", addressee_id: "p1", status: "pending" },
        { id: "f2", requester_id: "p1", addressee_id: "p3", status: "accepted" },
      ],
      profiles: [
        { id: "p1", username: "alice", full_name: "Alice Anders" },
        { id: "p2", username: "bob", full_name: "Bob Boers" },
        { id: "p3", username: "carol", full_name: "Carol Claes" },
      ],
    },
  }),
}));

import Friends from "./Friends";

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Friends />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<Friends />", () => {
  it("toont inkomend verzoek en bestaande vriend", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /^vrienden$/i }),
    ).toBeInTheDocument();
    // Bob stuurde een verzoek (inkomend), Carol is een geaccepteerde vriend.
    expect(await screen.findByText(/bob boers/i)).toBeInTheDocument();
    expect(await screen.findByText(/carol claes/i)).toBeInTheDocument();
  });
});
