import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "../features/auth/AuthProvider";

// Supabase-client mocken zodat de test geen netwerkcall doet.
vi.mock("./lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

// Rendert de app op /login (geen sessie => loginscherm zichtbaar).
function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<App /> loginscherm", () => {
  it("toont de inlog-titel", async () => {
    renderLogin();
    expect(
      await screen.findByRole("heading", { name: /welkom terug/i }),
    ).toBeInTheDocument();
  });

  it("wisselt naar de registreren-tab", async () => {
    renderLogin();
    await userEvent.click(await screen.findByRole("tab", { name: /registreren/i }));
    expect(
      screen.getByRole("heading", { name: /maak een account/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bevestig wachtwoord/i)).toBeInTheDocument();
  });

  it("wisselt de zichtbaarheid van het wachtwoord", async () => {
    renderLogin();
    const toggle = await screen.findByRole("button", { name: /toon wachtwoord/i });
    await userEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: /verberg wachtwoord/i }),
    ).toBeInTheDocument();
  });
});
