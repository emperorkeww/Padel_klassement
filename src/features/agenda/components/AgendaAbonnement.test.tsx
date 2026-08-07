import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/ui/ToastProvider";

const tables = vi.hoisted(() => ({}) as Record<string, unknown[]>);
const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  const mock = makeSupabaseMock({ session: SESSION, tables });
  return { supabase: { ...mock, rpc } };
});

import { AgendaAbonnement } from "./AgendaAbonnement";

const TOKEN = "427a530a-2cc4-4785-a3d8-d4bb3e6455fe";
const NIEUW = "11111111-2222-3333-4444-555555555555";

function toon() {
  return render(
    <ToastProvider>
      <AgendaAbonnement />
    </ToastProvider>,
  );
}

describe("<AgendaAbonnement /> (#1099)", () => {
  beforeEach(() => {
    rpc.mockReset();
    tables.calendar_feeds = [];
  });
  afterEach(() => vi.unstubAllGlobals());

  it("biedt zonder link één knop om er een te maken", async () => {
    toon();
    expect(
      await screen.findByRole("button", { name: /maak mijn agenda-link/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/persoonlijke link/i)).not.toBeInTheDocument();
  });

  it("toont de URL en de abonneerlink zodra je er een maakt", async () => {
    rpc.mockResolvedValue({ data: NIEUW, error: null });
    toon();

    await userEvent.click(
      await screen.findByRole("button", { name: /maak mijn agenda-link/i }),
    );

    const veld = await screen.findByLabelText<HTMLInputElement>(
      /persoonlijke link/i,
    );
    expect(veld.value).toContain(`/functions/v1/calendar-feed/${NIEUW}.ics`);
    // webcal:// opent op een telefoon meteen de agenda-app; https zou het
    // bestand downloaden en dan is het weer één momentopname.
    expect(
      screen.getByRole("link", { name: /abonneer in je agenda-app/i }),
    ).toHaveAttribute("href", expect.stringContaining("webcal://"));
  });

  it("kopieert de link naar het klembord", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    tables.calendar_feeds = [
      { token: TOKEN, player_id: "p1", created_at: "2026-08-01T10:00:00Z", revoked_at: null },
    ];
    toon();

    await userEvent.click(await screen.findByRole("button", { name: /kopieer/i }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining(`calendar-feed/${TOKEN}.ics`),
    );
    expect(await screen.findByRole("button", { name: /gekopieerd/i })).toBeInTheDocument();
  });

  /* Een nieuwe link breekt elk lopend abonnement. Dat mag niet achter één
     tik zitten, en de gebruiker moet vóór die tweede tik lezen waarom. */
  it("vraagt om een bevestiging vóór het een nieuwe link maakt", async () => {
    tables.calendar_feeds = [
      { token: TOKEN, player_id: "p1", created_at: "2026-08-01T10:00:00Z", revoked_at: null },
    ];
    rpc.mockResolvedValue({ data: NIEUW, error: null });
    toon();

    await userEvent.click(
      await screen.findByRole("button", { name: /nieuwe link maken/i }),
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(screen.getByText(/stopt elk abonnement dat nu loopt/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /zeker\? tik nogmaals/i }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("rotate_calendar_feed"));

    const veld = await screen.findByLabelText<HTMLInputElement>(/persoonlijke link/i);
    expect(veld.value).toContain(NIEUW);
  });

  // Dat de agenda-app zelf bepaalt hoe vaak hij ophaalt moet er staan: zonder
  // die zin leest een trage Google-refresh als een bug in onze app.
  it("zegt in gewone taal dat het ophalen traag kan zijn en de link privé is", async () => {
    tables.calendar_feeds = [
      { token: TOKEN, player_id: "p1", created_at: "2026-08-01T10:00:00Z", revoked_at: null },
    ];
    toon();

    expect(
      await screen.findByText(/google soms pas na een halve dag/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/hij is\s+je wachtwoord/i)).toBeInTheDocument();
  });
});
