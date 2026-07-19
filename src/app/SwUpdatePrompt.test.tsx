import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/ui/ToastProvider";

// De store wordt hier gemockt zodat de test niet van een echte SW afhangt.
const applyUpdate = vi.fn();
let updateAvailable = false;

vi.mock("@/lib/utils/swUpdate", () => ({
  subscribeSwUpdate: () => () => {},
  getSwUpdateSnapshot: () => updateAvailable,
  applyUpdate,
}));

// Ná de mock importeren, anders pakt de component de echte module.
const { SwUpdatePrompt } = await import("./SwUpdatePrompt");

afterEach(() => {
  updateAvailable = false;
  applyUpdate.mockClear();
});

function renderPrompt() {
  return render(
    <ToastProvider>
      <SwUpdatePrompt />
    </ToastProvider>,
  );
}

describe("SwUpdatePrompt", () => {
  it("toont geen toast als er geen update klaarstaat", () => {
    updateAvailable = false;
    renderPrompt();
    expect(screen.queryByText(/nieuwe versie/i)).not.toBeInTheDocument();
  });

  it("toont een tikbare toast en activeert de update bij een klik", async () => {
    updateAvailable = true;
    renderPrompt();

    const toast = await screen.findByRole("button", { name: /nieuwe versie/i });
    await userEvent.click(toast);

    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });
});
