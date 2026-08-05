import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Mock } from "vitest";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// De function-mock beslist per `action` wat er terugkomt, zodat één test kan
// nagaan dat er ná een afwijzende whoami niets meer gevraagd wordt.
const GEBRUIKERS = [
  {
    id: "u1",
    username: "stil",
    full_name: "Stille Sien",
    avatar_url: null,
    is_guest: false,
    owner_id: null,
    email: "sien@test.nl",
    created_at: "2026-02-01T10:00:00Z",
    last_sign_in_at: null,
    email_confirmed_at: null,
    banned_until: null,
    is_admin: false,
    aantal_groepen: 0,
    aantal_matches: 0,
    aantal_gasten: 0,
  },
  {
    id: "u2",
    username: "bob",
    full_name: "Bob Bakker",
    avatar_url: null,
    is_guest: false,
    owner_id: null,
    email: "bob@test.nl",
    created_at: "2026-03-01T10:00:00Z",
    last_sign_in_at: "2026-08-01T10:00:00Z",
    email_confirmed_at: "2026-03-01T10:00:00Z",
    banned_until: null,
    is_admin: true,
    aantal_groepen: 2,
    aantal_matches: 12,
    aantal_gasten: 0,
  },
];

let isAdminAntwoord = true;

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({
      session: SESSION,
      functions: {
        "admin-users": (body: unknown) => {
          const actie = (body as { action?: string }).action;
          if (actie === "whoami") return { admin: isAdminAntwoord };
          if (actie === "list_users") return { users: GEBRUIKERS };
          if (actie === "audit_log") return { regels: [] };
          if (actie === "user_detail") {
            return {
              detail: {
                groepen: [
                  {
                    id: "g1",
                    name: "Vrijdagavond Padel",
                    role: "owner",
                    joined_at: "2026-03-01T10:00:00Z",
                    is_eigenaar: true,
                  },
                ],
                matches: [],
                gasten: [],
                push_subscripties: 0,
              },
            };
          }
          return null;
        },
      },
    }),
  };
});

import { AdminPaneel } from "./AdminPaneel";
import { supabase } from "@/lib/supabase/client";
import { invalidateAll } from "@/lib/supabase/queryCache";

function renderPaneel() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <AdminPaneel />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function invokes() {
  return (supabase.functions.invoke as Mock).mock.calls;
}

describe("<AdminPaneel />", () => {
  beforeEach(() => {
    // whoami en de lijst worden gecachet; zonder legen ziet de tweede test
    // het antwoord van de eerste.
    invalidateAll();
    (supabase.functions.invoke as Mock).mockClear();
    isAdminAntwoord = true;
  });

  it("toont de gebruikerslijst met e-mail, aanmelddatum en laatste login", async () => {
    renderPaneel();
    expect(await screen.findByText("Bob Bakker")).toBeInTheDocument();
    expect(screen.getByText("bob@test.nl")).toBeInTheDocument();
    expect(screen.getByText("Stille Sien")).toBeInTheDocument();
    // "nooit ingelogd" is de vraag waarvoor dit paneel bestaat; die moet in de
    // lijst zelf te zien zijn en niet pas in een detailscherm.
    expect(screen.getByText("nooit")).toBeInTheDocument();
  });

  it("toont 'Geen toegang' en haalt geen gebruikers op voor een niet-beheerder", async () => {
    isAdminAntwoord = false;
    renderPaneel();
    expect(await screen.findByText("Geen toegang")).toBeInTheDocument();
    // De harde eis uit #1036: de route laadt geen data zonder rechten. Alleen
    // de whoami-vraag mag over de lijn zijn gegaan.
    const acties = invokes().map((c) => (c[1] as { body: { action: string } }).body.action);
    expect(acties).toEqual(["whoami"]);
  });

  it("filtert de lijst met het zoekveld", async () => {
    renderPaneel();
    await screen.findByText("Bob Bakker");
    await userEvent.type(
      screen.getByPlaceholderText(/Zoek op naam/),
      "sien",
    );
    expect(screen.queryByText("Bob Bakker")).not.toBeInTheDocument();
    expect(screen.getByText("Stille Sien")).toBeInTheDocument();
  });

  it("opent het detailpaneel bij een klik op een naam", async () => {
    renderPaneel();
    await userEvent.click(await screen.findByRole("button", { name: /Bob Bakker/ }));
    expect(await screen.findByText("Vrijdagavond Padel")).toBeInTheDocument();
  });
});
