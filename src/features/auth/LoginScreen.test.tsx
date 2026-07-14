import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./AuthProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  return { supabase: makeSupabaseMock({ session: null }) };
});

import LoginScreen from "./LoginScreen";
import { supabase } from "@/lib/supabase/client";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<LoginScreen />", () => {
  it("logt in met e-mail en wachtwoord", async () => {
    renderPage();
    await userEvent.type(
      await screen.findByPlaceholderText(/jij@voorbeeld/i),
      "alice@example.com",
    );
    const [wachtwoord] = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(wachtwoord, "geheim123");
    await userEvent.click(screen.getByRole("button", { name: /^inloggen$/i }));
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "geheim123",
    });
  });

  it("weigert registratie met niet-overeenkomende wachtwoorden", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /registreren/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/jij@voorbeeld/i),
      "nieuw@example.com",
    );
    const velden = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "geheim123");
    await userEvent.type(velden[1], "anders456");
    await userEvent.click(
      screen.getByRole("button", { name: /account aanmaken/i }),
    );
    expect(
      await screen.findByText(/wachtwoorden komen niet overeen/i),
    ).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("registreert met naam en gebruikersnaam in de metadata", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /registreren/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/voor- en achternaam/i),
      "Erik Elzinga",
    );
    await userEvent.type(screen.getByPlaceholderText(/bijv\. remco/i), "erik");
    await userEvent.type(
      screen.getByPlaceholderText(/jij@voorbeeld/i),
      "erik@example.com",
    );
    const velden = screen.getAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "geheim123");
    await userEvent.type(velden[1], "geheim123");
    await userEvent.click(
      screen.getByRole("button", { name: /account aanmaken/i }),
    );
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "erik@example.com",
      password: "geheim123",
      options: {
        data: { full_name: "Erik Elzinga", username: "erik" },
      },
    });
    expect(await screen.findByText(/account aangemaakt/i)).toBeInTheDocument();
  });

  it("stuurt een herstellink bij wachtwoord vergeten", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /wachtwoord vergeten/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/jij@voorbeeld/i),
      "alice@example.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /stuur herstellink/i }),
    );
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "alice@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("/reset-wachtwoord"),
      }),
    );
    expect(await screen.findByText(/herstellink gemaild/i)).toBeInTheDocument();
  });
});
