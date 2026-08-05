import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useConfirm } from "./ConfirmDialog";

// Kleine harnas: knop opent de bevestiging, de uitkomst (true/false) komt in
// een status-regel zodat de test kan controleren wat er teruggegeven is.
function Harness() {
  const [confirm, confirmUi] = useConfirm();
  return (
    <div>
      <button
        onClick={async () => {
          const ok = await confirm({
            title: "Vriend verwijderen?",
            body: "Alex wordt uit je vriendenlijst verwijderd.",
            confirmLabel: "Verwijderen",
            danger: true,
          });
          const out = document.getElementById("out");
          if (out) out.textContent = ok ? "bevestigd" : "geannuleerd";
        }}
      >
        Verwijderen
      </button>
      <span id="out" data-testid="out" />
      {confirmUi}
    </div>
  );
}

describe("<ConfirmDialog /> / useConfirm (#68)", () => {
  it("resolvet true wanneer op bevestigen geklikt wordt", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Verwijderen" }));

    // De dialoog verschijnt met titel en uitleg.
    const dialog = await screen.findByRole("dialog", {
      name: "Vriend verwijderen?",
    });
    expect(dialog).toHaveTextContent("Alex wordt uit je vriendenlijst verwijderd.");

    // Klik de rode bevestig-knop (binnen de dialoog, niet de trigger erbuiten).
    await user.click(within(dialog).getByRole("button", { name: "Verwijderen" }));

    await waitFor(() =>
      expect(screen.getByTestId("out")).toHaveTextContent("bevestigd"),
    );
    // Dialoog is gesloten.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("resolvet false via de annuleer-knop", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Verwijderen" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Annuleren" }));

    await waitFor(() =>
      expect(screen.getByTestId("out")).toHaveTextContent("geannuleerd"),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("resolvet false wanneer Escape wordt ingedrukt", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Verwijderen" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.getByTestId("out")).toHaveTextContent("geannuleerd"),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
// Type-to-confirm (#1036): voor acties waarbij "even doorklikken" niet mag.
function WoordHarness() {
  const [confirm, confirmUi] = useConfirm();
  return (
    <div>
      <button
        onClick={async () => {
          const ok = await confirm({
            title: "Account definitief verwijderen",
            bevestigWoord: "alice",
            confirmLabel: "Definitief verwijderen",
            danger: true,
          });
          const out = document.getElementById("out2");
          if (out) out.textContent = ok ? "bevestigd" : "geannuleerd";
        }}
      >
        Verwijderen
      </button>
      <span id="out2" data-testid="out2" />
      {confirmUi}
    </div>
  );
}

describe("<ConfirmDialog /> met bevestigWoord (#1036)", () => {
  it("houdt de bevestigknop uit tot het woord exact ingetikt is", async () => {
    render(<WoordHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Verwijderen" }));

    const knop = await screen.findByRole("button", { name: "Definitief verwijderen" });
    expect(knop).toBeDisabled();

    const veld = screen.getByRole("textbox");
    await userEvent.type(veld, "alic");
    expect(knop).toBeDisabled();

    await userEvent.type(veld, "e");
    expect(knop).toBeEnabled();
  });

  it("is hoofdlettergevoelig — een username is geen benadering", async () => {
    render(<WoordHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Verwijderen" }));
    await userEvent.type(screen.getByRole("textbox"), "Alice");
    expect(
      screen.getByRole("button", { name: "Definitief verwijderen" }),
    ).toBeDisabled();
  });

  it("laat Enter niet bevestigen zolang het woord niet klopt", async () => {
    render(<WoordHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Verwijderen" }));
    await userEvent.type(screen.getByRole("textbox"), "iets{Enter}");
    expect(screen.getByTestId("out2")).toHaveTextContent("");

    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "alice{Enter}");
    await waitFor(() => expect(screen.getByTestId("out2")).toHaveTextContent("bevestigd"));
  });

  it("laat bestaande bevestigingen zónder bevestigWoord ongemoeid", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Verwijderen" }));
    const dialoog = await screen.findByRole("dialog");
    // Geen invoerveld, en de bevestigknop is meteen bruikbaar — precies het
    // gedrag dat elke bestaande call-site verwacht.
    expect(within(dialoog).queryByRole("textbox")).toBeNull();
    expect(
      within(dialoog).getByRole("button", { name: "Verwijderen" }),
    ).toBeEnabled();
  });
});
