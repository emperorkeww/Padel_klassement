import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/utils/pwa", () => ({
  isIos: vi.fn(() => false),
  isStandalone: vi.fn(() => false),
  getInstallPromptEvent: vi.fn(() => null),
  subscribeInstallPrompt: vi.fn(() => () => {}),
  clearInstallPromptEvent: vi.fn(),
}));
vi.mock("@/lib/supabase/push", () => ({
  pushAvailability: vi.fn(() => "ready"),
  getPushSubscription: vi.fn(() => Promise.resolve(null)),
  enablePush: vi.fn(() => Promise.resolve()),
}));

import { DashboardPrompts } from "./DashboardPrompts";
import {
  getInstallPromptEvent,
  isIos,
  isStandalone,
  type BeforeInstallPromptEvent,
} from "@/lib/utils/pwa";
import { pushAvailability } from "@/lib/supabase/push";

// Node's globale localStorage (zonder --localstorage-file) is een kreupele stub
// die ook window.localStorage overschaduwt; vervang hem door een simpele map
// zodat de dismiss-vlaggen echt gelezen kunnen worden.
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

const installEvent = {
  prompt: vi.fn(() => Promise.resolve()),
  userChoice: Promise.resolve({ outcome: "accepted" as const }),
} as unknown as BeforeInstallPromptEvent;

function renderPrompts() {
  return render(
    <ToastProvider>
      <DashboardPrompts userId="alice" />
    </ToastProvider>,
  );
}

const installKaart = () => screen.queryByText(/zet op je beginscherm/i);
const pushKaart = () => screen.queryByText(/mis niks/i);

beforeEach(() => {
  store = {};
  // jsdom heeft geen Notification; zonder stub valt PushPrompt terug op
  // "denied" en zou hij nooit iets tonen.
  vi.stubGlobal("Notification", { permission: "default" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(isIos).mockReturnValue(false);
  vi.mocked(isStandalone).mockReturnValue(false);
  vi.mocked(getInstallPromptEvent).mockReturnValue(null);
  vi.mocked(pushAvailability).mockReturnValue("ready");
});

// #911: install- en push-prompt stonden direct na elkaar op het overzicht,
// elk met hun eigen regels en zonder onderlinge volgorde. Een nieuwe gebruiker
// kon zo twee onderbrekingen onder elkaar krijgen.
describe("<DashboardPrompts />", () => {
  it("toont alleen de installatie-prompt als beide zouden kunnen", async () => {
    vi.mocked(getInstallPromptEvent).mockReturnValue(installEvent);
    renderPrompts();

    expect(await screen.findByText(/zet op je beginscherm/i)).toBeInTheDocument();
    expect(pushKaart()).toBeNull();
  });

  it("laat push aan de beurt als installeren niets te bieden heeft", async () => {
    // Geen beforeinstallprompt-event en geen iOS → de installatie-prompt zou
    // toch niets tonen.
    renderPrompts();

    expect(await screen.findByText(/mis niks/i)).toBeInTheDocument();
    expect(installKaart()).toBeNull();
  });

  it("geeft op iOS de installatie voorrang — daar werkt push pas ná installatie", async () => {
    vi.mocked(isIos).mockReturnValue(true);
    renderPrompts();

    expect(await screen.findByText(/zet op je beginscherm/i)).toBeInTheDocument();
    expect(pushKaart()).toBeNull();
  });

  it("toont niets als geen van beide iets te vragen heeft", () => {
    // Standalone: installeren is klaar. Push niet beschikbaar.
    vi.mocked(isStandalone).mockReturnValue(true);
    vi.mocked(pushAvailability).mockReturnValue("unsupported");
    const { container } = renderPrompts();

    expect(installKaart()).toBeNull();
    expect(pushKaart()).toBeNull();
    expect(container.querySelector(".push-prompt")).toBeNull();
  });
});
