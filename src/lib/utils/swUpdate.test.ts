import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Minimale EventTarget-fakes voor de service-worker-API. Zo kunnen we
// updatefound/statechange/controllerchange echt dispatchen.
class FakeWorker extends EventTarget {
  state = "installing";
  postMessage = vi.fn();
  setState(state: string) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
}

class FakeContainer extends EventTarget {
  controller: object | null = null;
  registration = new FakeRegistration();
  register = vi.fn(() => Promise.resolve(this.registration));
}

let container: FakeContainer;
let reload: ReturnType<typeof vi.fn>;

// Fris moduleniveau per test: swUpdate houdt de "waiting"-status module-global.
async function loadModule() {
  vi.resetModules();
  return import("./swUpdate");
}

// register() gebeurt achter een 'load'-event + microtask-chain; even doorspoelen.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  container = new FakeContainer();
  vi.stubGlobal("navigator", { serviceWorker: container });
  reload = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { reload },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("registerServiceWorker", () => {
  it("toont geen update bij de allereerste install (geen controller)", async () => {
    const { registerServiceWorker, getSwUpdateSnapshot } = await loadModule();
    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    await flush();

    const installing = new FakeWorker();
    container.registration.installing = installing;
    container.registration.dispatchEvent(new Event("updatefound"));
    installing.setState("installed"); // controller is nog null

    expect(getSwUpdateSnapshot()).toBe(false);
  });

  it("signaleert een update wanneer een nieuwe worker installeert met controller", async () => {
    const { registerServiceWorker, getSwUpdateSnapshot, subscribeSwUpdate } =
      await loadModule();
    const listener = vi.fn();
    subscribeSwUpdate(listener);

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    await flush();

    container.controller = {}; // er draait al een SW
    const installing = new FakeWorker();
    container.registration.installing = installing;
    container.registration.dispatchEvent(new Event("updatefound"));
    container.registration.waiting = installing;
    installing.setState("installed");

    expect(getSwUpdateSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it("herkent een al wachtende worker bij registratie", async () => {
    const { registerServiceWorker, getSwUpdateSnapshot } = await loadModule();
    container.controller = {};
    container.registration.waiting = new FakeWorker();

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    await flush();

    expect(getSwUpdateSnapshot()).toBe(true);
  });

  it("herlaadt precies één keer bij controllerchange", async () => {
    const { registerServiceWorker } = await loadModule();
    registerServiceWorker();

    container.dispatchEvent(new Event("controllerchange"));
    container.dispatchEvent(new Event("controllerchange"));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("applyUpdate", () => {
  it("post SKIP_WAITING naar de wachtende worker", async () => {
    const { registerServiceWorker, applyUpdate } = await loadModule();
    const waiting = new FakeWorker();
    container.controller = {};
    container.registration.waiting = waiting;

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    await flush();

    applyUpdate();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("is een no-op zonder wachtende worker", async () => {
    const { applyUpdate } = await loadModule();
    expect(() => applyUpdate()).not.toThrow();
  });
});
