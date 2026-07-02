import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

vi.mock("../../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  const { TABLES, SESSION } = await import("../../test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES, rpc: "m-new" }) };
});

import Matches from "./Matches";
import { supabase } from "../../lib/supabase";

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Matches />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<Matches />", () => {
  it("toont Te spelen met inline invoer en de recente matches", async () => {
    renderPage();
    expect(await screen.findByText(/te spelen/i)).toBeInTheDocument();
    // De geplande match heeft twee score-invoervelden met teamnamen als label.
    expect(
      await screen.findByLabelText(/^score alice anders & bob boers$/i),
    ).toBeInTheDocument();
    expect(await screen.findByText(/recente matches/i)).toBeInTheDocument();
    // De afgeronde match staat in de lijst met de eindscore.
    expect(await screen.findByText("6–3")).toBeInTheDocument();
  });

  it("filtert op Gewonnen", async () => {
    renderPage();
    await screen.findByText("6–3");
    await userEvent.click(screen.getByRole("button", { name: /^gewonnen$/i }));
    expect(screen.getByText("6–3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^verloren$/i }));
    expect(screen.queryByText("6–3")).not.toBeInTheDocument();
    expect(screen.getByText(/geen matches voor dit filter/i)).toBeInTheDocument();
  });

  it("logt een match via de wizard (spelers → score → opslaan)", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /match loggen/i }),
    );
    const sheet = within(await screen.findByRole("dialog"));
    expect(sheet.getByText(/wie speelden er/i)).toBeInTheDocument();

    // Vier spelers aantikken: eerst team A (Alice + Bob), dan team B.
    for (const naam of [/alice anders/i, /bob boers/i, /carol claes/i, /dave de vos/i]) {
      await userEvent.click(sheet.getByRole("button", { name: naam }));
    }
    expect(sheet.getByText(/team a/i)).toBeInTheDocument();
    await userEvent.click(sheet.getByRole("button", { name: /naar de score/i }));

    await userEvent.type(sheet.getByLabelText("Score team A"), "6");
    await userEvent.type(sheet.getByLabelText("Score team B"), "4");
    expect(sheet.getByText(/winnen — 3 punten/i)).toBeInTheDocument();

    await userEvent.click(sheet.getByRole("button", { name: /match opslaan/i }));
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_completed_match",
      expect.objectContaining({ p_winner: "a", p_score_a: 6, p_score_b: 4 }),
    );
    // Sheet sluit na opslaan.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sluit de wizard met Escape", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /match loggen/i }),
    );
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
