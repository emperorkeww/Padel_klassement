import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

vi.mock("../../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  const { TABLES, SESSION } = await import("../../test/fixtures");
  return {
    supabase: makeSupabaseMock({ session: SESSION, tables: TABLES, rpc: ["m-x"] }),
  };
});

import GroupDetail from "./GroupDetail";
import { supabase } from "../../lib/supabase";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/groepen/g1"]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/groepen/:id" element={<GroupDetail />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<GroupDetail />", () => {
  it("toont de rondes met voortgang; ronde 2 heeft open uitslagen", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /vrijdagavond padel/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/4 leden · jij bent eigenaar/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /^ronde 2$/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("0/1 uitslagen")).toBeInTheDocument();
    expect(await screen.findByText(/^afgerond$/i)).toBeInTheDocument();
  });

  it("blokkeert Mexicano zolang een ronde open staat", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("button", { name: /^mexicano$/i }));
    expect(
      screen.getByRole("button", { name: /genereer mexicano-ronde/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/vul eerst alle uitslagen van ronde 2 in/i),
    ).toBeInTheDocument();
  });

  it("genereert een Americano-ronde via de RPC", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(
      screen.getByRole("button", { name: /genereer americano-ronde/i }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith("generate_americano_round", {
      p_group_id: "g1",
    });
  });

  it("toont Stand en Leden in eigen tabbladen", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("button", { name: /^stand$/i }));
    expect(await screen.findByText(/groepsklassement/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^leden$/i }));
    expect(await screen.findByText(/vriend toevoegen/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /verwijderen/i }).length,
    ).toBeGreaterThan(0);
  });

  it("slaat een uitslag optimistisch op vanuit de rondekaart", async () => {
    renderPage();
    const inputA = await screen.findByLabelText(/^score alice anders & bob boers$/i);
    const inputB = await screen.findByLabelText(/^score carol claes & dave de vos$/i);
    await userEvent.type(inputA, "7");
    await userEvent.type(inputB, "5");
    await userEvent.click(screen.getByRole("button", { name: /^opslaan$/i }));
    // Optimistisch: de kaart toont direct de uitslag.
    expect(await screen.findByText("7–5")).toBeInTheDocument();
    expect(await screen.findByText("opgeslagen ✓")).toBeInTheDocument();
  });
});
