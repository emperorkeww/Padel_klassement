import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

// Supabase-client mocken zodat de test geen netwerkcall doet.
vi.mock("./lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe("<App /> loginscherm", () => {
  it("toont de inlog-titel", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /welkom terug/i }),
    ).toBeInTheDocument();
  });

  it("wisselt naar de registreren-tab", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("tab", { name: /registreren/i }));
    expect(
      screen.getByRole("heading", { name: /maak een account/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bevestig wachtwoord/i)).toBeInTheDocument();
  });

  it("wisselt de zichtbaarheid van het wachtwoord", async () => {
    render(<App />);
    const toggle = screen.getByRole("button", { name: /toon wachtwoord/i });
    await userEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: /verberg wachtwoord/i }),
    ).toBeInTheDocument();
  });
});
