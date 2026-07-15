import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import ProfileSettings from "./ProfileSettings";
import { supabase } from "@/lib/supabase/client";

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <ProfileSettings />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<ProfileSettings />", () => {
  it("toont profiel-, naam-, e-mail- en wachtwoordkaarten", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /^profiel$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/profielfoto/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("alice")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alice Anders")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /e-mailadres/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /wachtwoord wijzigen/i }),
    ).toBeInTheDocument();
  });

  it("wisselt het thema via de weergavekaart", async () => {
    // jsdom kent geen matchMedia; alleen nodig zodra de keuze "systeem" is.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      renderPage();
      expect(
        await screen.findByRole("heading", { name: /weergave/i }),
      ).toBeInTheDocument();
      const donker = screen.getByRole("radio", { name: /donker/i });
      await userEvent.click(donker);
      expect(donker).toHaveAttribute("aria-checked", "true");
      expect(document.documentElement.dataset.theme).toBe("dark");

      await userEvent.click(screen.getByRole("radio", { name: /licht/i }));
      expect(document.documentElement.dataset.theme).toBe("light");
    } finally {
      vi.unstubAllGlobals();
      delete document.documentElement.dataset.theme;
    }
  });

  it("slaat een nieuwe naam op", async () => {
    renderPage();
    const veld = await screen.findByDisplayValue("Alice Anders");
    await userEvent.clear(veld);
    await userEvent.type(veld, "Alice A. Anders");
    await userEvent.click(screen.getAllByRole("button", { name: /^opslaan$/i })[1]);
    expect(await screen.findByText(/naam bijgewerkt/i)).toBeInTheDocument();
  });

  it("wijzigt het e-mailadres via supabase auth", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /e-mailadres/i });
    await userEvent.type(
      screen.getByPlaceholderText(/nieuw@voorbeeld/i),
      "alice@nieuw.nl",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /e-mail wijzigen/i }),
    );
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      email: "alice@nieuw.nl",
    });
  });

  it("verifieert het huidige wachtwoord vóór wijziging", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /e-mailadres/i });
    await userEvent.type(screen.getByLabelText(/huidig wachtwoord/i), "geheim1");
    await userEvent.type(screen.getByLabelText(/^nieuw wachtwoord$/i), "geheim2");
    await userEvent.type(
      screen.getByLabelText(/bevestig nieuw wachtwoord/i),
      "geheim2",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /wachtwoord wijzigen/i }),
    );
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "geheim1",
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: "geheim2",
    });
  });
});
