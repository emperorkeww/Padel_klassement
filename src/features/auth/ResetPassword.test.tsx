import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Mock } from "vitest";
import { AuthProvider } from "./AuthProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  // Een herstellink levert een (recovery-)sessie op; het formulier is dan zichtbaar.
  return { supabase: makeSupabaseMock({ session: SESSION }) };
});

import ResetPassword from "./ResetPassword";
import { supabase } from "@/lib/supabase/client";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/reset-wachtwoord"]}>
      <AuthProvider>
        <ResetPassword />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<ResetPassword />", () => {
  it("weigert een te kort of niet-overeenkomend wachtwoord", async () => {
    renderPage();
    const velden = await screen.findAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "kort");
    await userEvent.type(velden[1], "kort");
    await userEvent.click(screen.getByRole("button", { name: /wachtwoord opslaan/i }));
    expect(await screen.findByText(/minstens 6 tekens/i)).toBeInTheDocument();

    await userEvent.type(velden[0], "erbij-lang-genoeg");
    await userEvent.click(screen.getByRole("button", { name: /wachtwoord opslaan/i }));
    expect(
      await screen.findByText(/komen niet overeen/i),
    ).toBeInTheDocument();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("zet het nieuwe wachtwoord via supabase auth", async () => {
    renderPage();
    const velden = await screen.findAllByPlaceholderText("••••••••");
    await userEvent.type(velden[0], "nieuwgeheim");
    await userEvent.type(velden[1], "nieuwgeheim");
    await userEvent.click(screen.getByRole("button", { name: /wachtwoord opslaan/i }));
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: "nieuwgeheim",
    });
    expect(await screen.findByText(/wachtwoord gewijzigd/i)).toBeInTheDocument();
  });

  it("meldt een ongeldige herstellink zonder sessie", async () => {
    (supabase.auth.getSession as Mock).mockResolvedValueOnce({
      data: { session: null },
    });
    renderPage();
    expect(
      await screen.findByText(/herstellink is ongeldig of verlopen/i),
    ).toBeInTheDocument();
  });
});
