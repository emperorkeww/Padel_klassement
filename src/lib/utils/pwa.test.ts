import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearInstallPromptEvent,
  getInstallPromptEvent,
  initInstallPromptCapture,
  isIos,
  isStandalone,
  subscribeInstallPrompt,
} from "./pwa";

afterEach(() => {
  vi.unstubAllGlobals();
  clearInstallPromptEvent();
});

function stubNavigator(overrides: Record<string, unknown>) {
  vi.stubGlobal("navigator", { userAgent: "", maxTouchPoints: 0, ...overrides });
}

describe("isIos", () => {
  it("herkent iPhone en iPad aan de user agent", () => {
    stubNavigator({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15",
    });
    expect(isIos()).toBe(true);

    stubNavigator({
      userAgent: "Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15",
    });
    expect(isIos()).toBe(true);
  });

  it("herkent iPadOS 13+ dat zich als Mac voordoet (Mac-UA met touch)", () => {
    stubNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      maxTouchPoints: 5,
    });
    expect(isIos()).toBe(true);
  });

  it("is false voor een echte Mac, Android en de jsdom-default", () => {
    stubNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      maxTouchPoints: 0,
    });
    expect(isIos()).toBe(false);

    stubNavigator({
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36",
    });
    expect(isIos()).toBe(false);

    vi.unstubAllGlobals();
    expect(isIos()).toBe(false);
  });
});

describe("isStandalone", () => {
  it("is false in kale jsdom (geen matchMedia) zonder te gooien", () => {
    expect(isStandalone()).toBe(false);
  });

  it("is true wanneer de display-mode media query matcht", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(display-mode: standalone)",
    }));
    expect(isStandalone()).toBe(true);
  });

  it("valt terug op Safari's navigator.standalone-vlag", () => {
    stubNavigator({ standalone: true });
    expect(isStandalone()).toBe(true);

    stubNavigator({ standalone: false });
    expect(isStandalone()).toBe(false);
  });
});

describe("install-prompt-capture", () => {
  function fakePromptEvent() {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    return Object.assign(event, {
      prompt: vi.fn(() => Promise.resolve()),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
  }

  it("bewaart het event, notificeert abonnees en wist bij appinstalled", () => {
    initInstallPromptCapture();
    const listener = vi.fn();
    const unsubscribe = subscribeInstallPrompt(listener);

    const event = fakePromptEvent();
    window.dispatchEvent(event);
    expect(getInstallPromptEvent()).toBe(event);
    expect(event.defaultPrevented).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("appinstalled"));
    expect(getInstallPromptEvent()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("clearInstallPromptEvent wist het bewaarde event", () => {
    initInstallPromptCapture();
    window.dispatchEvent(fakePromptEvent());
    expect(getInstallPromptEvent()).not.toBeNull();

    clearInstallPromptEvent();
    expect(getInstallPromptEvent()).toBeNull();
  });
});
