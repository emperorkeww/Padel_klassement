import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/push", () => ({
  pushAvailability: vi.fn(() => "ready"),
  getPushSubscription: vi.fn(() => Promise.resolve(null)),
  enablePush: vi.fn(() => Promise.resolve()),
}));

import { PushPrompt } from "./PushPrompt";
import {
  enablePush,
  getPushSubscription,
  pushAvailability,
} from "@/lib/supabase/push";

function renderPrompt() {
  return render(
    <ToastProvider>
      <PushPrompt userId="alice" />
    </ToastProvider>,
  );
}

// Node's globale localStorage (zonder --localstorage-file) is een kreupele
// stub die ook window.localStorage overschaduwt; vervang hem door een simpele
// map zodat de dismiss-vlag echt gelezen/geschreven kan worden.
let store: Record<string, string> = {};
const mapStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
};
for (const target of [window, globalThis]) {
  Object.defineProperty(target, "localStorage", {
    configurable: true,
    value: mapStorage,
  });
}

beforeEach(() => {
  store = {};
  // jsdom heeft geen Notification; zonder stub valt de component terug op
  // "denied" en blijft de prompt onterecht verborgen.
  vi.stubGlobal("Notification", { permission: "default" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(pushAvailability).mockReturnValue("ready");
  vi.mocked(getPushSubscription).mockResolvedValue(null);
  vi.mocked(enablePush).mockReset();
  vi.mocked(enablePush).mockResolvedValue(undefined);
});

describe("<PushPrompt />", () => {
  it("toont de uitnodiging bij ondersteuning zonder bestaand abonnement", async () => {
    renderPrompt();
    expect(await screen.findByText(/mis niks/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /meldingen aanzetten/i }),
    ).toBeInTheDocument();
  });

  it.each(["needs-install", "denied", "unsupported"] as const)(
    "blijft verborgen wanneer push niet beschikbaar is (%s)",
    (availability) => {
      vi.mocked(pushAvailability).mockReturnValue(availability);
      renderPrompt();
      expect(screen.queryByText(/mis niks/i)).not.toBeInTheDocument();
    },
  );

  it("blijft verborgen met een bestaand abonnement", async () => {
    vi.mocked(getPushSubscription).mockResolvedValue({
      endpoint: "https://push.example/abc",
    } as PushSubscription);
    renderPrompt();
    // Even de subscription-check laten uitkomen; daarna nog steeds niets.
    await vi.waitFor(() =>
      expect(getPushSubscription).toHaveBeenCalled(),
    );
    expect(screen.queryByText(/mis niks/i)).not.toBeInTheDocument();
  });

  it("blijft verborgen wanneer de permissie al geweigerd is", () => {
    vi.stubGlobal("Notification", { permission: "denied" });
    renderPrompt();
    expect(screen.queryByText(/mis niks/i)).not.toBeInTheDocument();
  });

  it("blijft verborgen na eerder wegklikken", () => {
    store["push-prompt-dismissed"] = "1";
    renderPrompt();
    expect(screen.queryByText(/mis niks/i)).not.toBeInTheDocument();
  });

  it("'Niet nu' verbergt de kaart en onthoudt dat", async () => {
    renderPrompt();
    await userEvent.click(await screen.findByRole("button", { name: /niet nu/i }));
    expect(screen.queryByText(/mis niks/i)).not.toBeInTheDocument();
    expect(store["push-prompt-dismissed"]).toBe("1");
  });

  it("zet meldingen aan en verdwijnt daarna", async () => {
    renderPrompt();
    await userEvent.click(
      await screen.findByRole("button", { name: /meldingen aanzetten/i }),
    );
    expect(enablePush).toHaveBeenCalledWith("alice");
    expect(await screen.findByText(/vamos/i)).toBeInTheDocument();
    expect(screen.queryByText(/mis niks/i)).not.toBeInTheDocument();
  });
});
