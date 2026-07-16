import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/utils/pwa", () => ({
  isIos: vi.fn(() => false),
  isStandalone: vi.fn(() => false),
  getInstallPromptEvent: vi.fn(() => null),
  subscribeInstallPrompt: vi.fn(() => () => {}),
  clearInstallPromptEvent: vi.fn(),
}));

import { InstallPrompt } from "./InstallPrompt";
import {
  clearInstallPromptEvent,
  getInstallPromptEvent,
  isIos,
  isStandalone,
  type BeforeInstallPromptEvent,
} from "@/lib/utils/pwa";

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

function fakePromptEvent(outcome: "accepted" | "dismissed") {
  return {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome }),
  } as unknown as BeforeInstallPromptEvent;
}

beforeEach(() => {
  store = {};
});

afterEach(() => {
  vi.mocked(isIos).mockReturnValue(false);
  vi.mocked(isStandalone).mockReturnValue(false);
  vi.mocked(getInstallPromptEvent).mockReturnValue(null);
  vi.mocked(clearInstallPromptEvent).mockClear();
});

describe("<InstallPrompt />", () => {
  it("blijft verborgen zodra de app standalone draait", () => {
    vi.mocked(isIos).mockReturnValue(true);
    vi.mocked(isStandalone).mockReturnValue(true);
    render(<InstallPrompt />);
    expect(screen.queryByText(/beginscherm/i)).not.toBeInTheDocument();
  });

  it("blijft verborgen zonder install-event op niet-iOS", () => {
    render(<InstallPrompt />);
    expect(screen.queryByText(/beginscherm/i)).not.toBeInTheDocument();
  });

  it("toont op iOS de Deel → Zet op beginscherm-instructie zonder installeerknop", () => {
    vi.mocked(isIos).mockReturnValue(true);
    render(<InstallPrompt />);
    expect(screen.getByText(/zet op beginscherm/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /installeer de app/i }),
    ).not.toBeInTheDocument();
  });

  it("'Niet nu' verbergt de kaart en onthoudt dat", async () => {
    vi.mocked(isIos).mockReturnValue(true);
    render(<InstallPrompt />);
    await userEvent.click(screen.getByRole("button", { name: /niet nu/i }));
    expect(screen.queryByText(/beginscherm/i)).not.toBeInTheDocument();
    expect(store["install-prompt-dismissed"]).toBe("1");
  });

  it("blijft verborgen na eerder wegklikken", () => {
    store["install-prompt-dismissed"] = "1";
    vi.mocked(isIos).mockReturnValue(true);
    render(<InstallPrompt />);
    expect(screen.queryByText(/beginscherm/i)).not.toBeInTheDocument();
  });

  it("opent de native prompt via het bewaarde beforeinstallprompt-event", async () => {
    const event = fakePromptEvent("accepted");
    vi.mocked(getInstallPromptEvent).mockReturnValue(event);
    render(<InstallPrompt />);
    await userEvent.click(
      screen.getByRole("button", { name: /installeer de app/i }),
    );
    expect(event.prompt).toHaveBeenCalled();
    // Chrome staat één prompt() per event toe — daarna wordt het gewist.
    expect(clearInstallPromptEvent).toHaveBeenCalled();
    expect(store["install-prompt-dismissed"]).toBeUndefined();
  });

  it("onthoudt een afgewezen native prompt als wegklikken", async () => {
    const event = fakePromptEvent("dismissed");
    vi.mocked(getInstallPromptEvent).mockReturnValue(event);
    render(<InstallPrompt />);
    await userEvent.click(
      screen.getByRole("button", { name: /installeer de app/i }),
    );
    expect(store["install-prompt-dismissed"]).toBe("1");
    expect(screen.queryByText(/beginscherm/i)).not.toBeInTheDocument();
  });
});
