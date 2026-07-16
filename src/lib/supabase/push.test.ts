import { afterEach, describe, it, expect, vi } from "vitest";
import {
  enablePush,
  getPushSubscription,
  pushAvailability,
  pushSupported,
  urlBase64ToUint8Array,
} from "@/lib/supabase/push";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** Stubt alles wat pushSupported() nodig heeft, met een instelbare service worker. */
function stubPushEnvironment({
  permission = "default",
  serviceWorker = {},
}: {
  permission?: NotificationPermission;
  serviceWorker?: Partial<ServiceWorkerContainer>;
} = {}) {
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "AQID");
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission });
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    serviceWorker,
  });
}

describe("push", () => {
  it("decodeert een base64url-VAPID-sleutel naar bytes", () => {
    // "AQID" (base64url) = bytes [1, 2, 3]
    expect([...urlBase64ToUint8Array("AQID")]).toEqual([1, 2, 3]);
    // url-safe tekens - en _ worden vertaald (voorkomt atob-fouten).
    expect([...urlBase64ToUint8Array("-_8")]).toEqual([251, 255]);
  });

  it("meldt geen ondersteuning zonder PushManager (jsdom)", () => {
    expect(pushSupported()).toBe(false);
  });

  it("weigert inschakelen netjes zonder ondersteuning", async () => {
    await expect(enablePush("p1")).rejects.toThrow(/niet ondersteund/i);
  });
});

describe("pushAvailability", () => {
  it("is 'unsupported' in kale jsdom", () => {
    expect(pushAvailability()).toBe("unsupported");
  });

  it("is 'needs-install' op iOS in een browsertab (geen PushManager)", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15",
      maxTouchPoints: 5,
    });
    expect(pushAvailability()).toBe("needs-install");
  });

  it("is 'unsupported' op iOS wanneer de app al standalone draait", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15",
      standalone: true,
    });
    expect(pushAvailability()).toBe("unsupported");
  });

  it("is 'ready' met service worker, PushManager en VAPID-sleutel", () => {
    stubPushEnvironment();
    expect(pushAvailability()).toBe("ready");
  });

  it("is 'denied' wanneer de permissie eerder geweigerd is", () => {
    stubPushEnvironment({ permission: "denied" });
    expect(pushAvailability()).toBe("denied");
  });
});

describe("getPushSubscription", () => {
  it("hangt niet op serviceWorker.ready maar valt na de timeout terug op null", async () => {
    vi.useFakeTimers();
    stubPushEnvironment({
      serviceWorker: {
        getRegistration: () => Promise.resolve(undefined),
        ready: new Promise(() => {}), // resolvet nooit — het #412-scenario
      },
    });

    const pending = getPushSubscription();
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBeNull();
  });

  it("geeft het abonnement terug via een al-actieve registratie, zonder te wachten", async () => {
    const fakeSub = { endpoint: "https://push.example/abc" };
    stubPushEnvironment({
      serviceWorker: {
        getRegistration: () =>
          Promise.resolve({
            active: {},
            pushManager: { getSubscription: () => Promise.resolve(fakeSub) },
          } as unknown as ServiceWorkerRegistration),
        ready: new Promise(() => {}),
      },
    });

    await expect(getPushSubscription()).resolves.toBe(fakeSub);
  });
});

describe("enablePush", () => {
  it("geeft een duidelijke fout wanneer de service worker onbereikbaar blijft", async () => {
    vi.useFakeTimers();
    stubPushEnvironment({
      serviceWorker: {
        getRegistration: () => Promise.resolve(undefined),
        ready: new Promise(() => {}),
      },
    });
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: () => Promise.resolve("granted"),
    });

    const pending = enablePush("p1");
    // Vang de rejection alvast op vóór we de timers doorspoelen, anders
    // telt Vitest hem als unhandled.
    const assertion = expect(pending).rejects.toThrow(/herlaad de app/i);
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
  });

  it("legt bij geweigerde toestemming uit waar je die weer aanzet", async () => {
    stubPushEnvironment();
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: () => Promise.resolve("denied"),
    });

    await expect(enablePush("p1")).rejects.toThrow(/instellingen/i);
  });
});
