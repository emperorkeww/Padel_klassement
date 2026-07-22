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