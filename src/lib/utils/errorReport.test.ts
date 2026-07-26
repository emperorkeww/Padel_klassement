import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// De module houdt een teller en een dedup-set bij. In plaats van een
// test-only reset-export importeren we hem per test opnieuw.
async function verseModule() {
  vi.resetModules();
  return import("@/lib/utils/errorReport");
}

let beacon: ReturnType<typeof vi.fn>;

beforeEach(() => {
  beacon = vi.fn(() => true);
  vi.stubGlobal("navigator", {
    sendBeacon: beacon,
    userAgent: "Mozilla/5.0 (test)",
  });
  // De rapportage stuurt alleen in productie écht iets weg.
  vi.stubEnv("PROD", true);
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  sessionStorage.clear();
});

/** De payload van de n-de sendBeacon-aanroep, als object. */
async function payload(n = 0) {
  return JSON.parse(await beacon.mock.calls[n][1].text());
}

describe("meldFout", () => {
  it("stuurt de melding naar het eigen endpoint", async () => {
    const { meldFout } = await verseModule();
    meldFout({ bron: "render", bericht: "kapot", stack: "Error: kapot\n at x", scope: "pagina" });

    expect(beacon).toHaveBeenCalledOnce();
    expect(beacon.mock.calls[0][0]).toBe("/api/client-error");
    const p = await payload();
    expect(p).toMatchObject({
      bron: "render",
      bericht: "kapot",
      scope: "pagina",
      chunk: false,
    });
    expect(p.stack).toContain("Error: kapot");
  });

  it("stuurt geen persoonsgegevens mee", async () => {
    const { meldFout } = await verseModule();
    meldFout({ bron: "render", bericht: "kapot" });

    const p = await payload();
    // Alleen deze velden, en dus geen user-id, e-mail of token.
    expect(Object.keys(p).sort()).toEqual(
      ["bericht", "build", "bron", "chunk", "pad", "sessie", "ua"].sort(),
    );
  });

  it("houdt meldingen uit dezelfde sessie bij elkaar", async () => {
    const { meldFout } = await verseModule();
    meldFout({ bron: "render", bericht: "eerste" });
    meldFout({ bron: "render", bericht: "tweede" });

    const [a, b] = [await payload(0), await payload(1)];
    expect(a.sessie).toBe(b.sessie);
    expect(a.sessie).not.toBe("onbekend");
  });

  it("labelt een verdwenen chunk apart, zodat die de echte crashes niet ondersneeuwt", async () => {
    const { meldFout } = await verseModule();
    meldFout({
      bron: "render",
      bericht: "Failed to fetch dynamically imported module: /assets/Feed-abc.js",
    });
    expect((await payload()).chunk).toBe(true);
  });

  it("meldt dezelfde fout maar één keer (vangt ook StrictMode's dubbele render)", async () => {
    const { meldFout } = await verseModule();
    meldFout({ bron: "render", bericht: "kapot" });
    meldFout({ bron: "render", bericht: "kapot" });
    expect(beacon).toHaveBeenCalledOnce();
  });

  it("stopt na vijf meldingen per sessie", async () => {
    const { meldFout } = await verseModule();
    for (let i = 0; i < 9; i++) meldFout({ bron: "render", bericht: `fout ${i}` });
    expect(beacon).toHaveBeenCalledTimes(5);
  });

  it("kapt een lange stack af", async () => {
    const { meldFout } = await verseModule();
    meldFout({ bron: "render", bericht: "kapot", stack: "x".repeat(9000) });
    expect((await payload()).stack.length).toBeLessThanOrEqual(1500);
  });

  it("valt terug op fetch als sendBeacon niet lukt", async () => {
    beacon.mockReturnValue(false);
    // Getypeerd via een generic i.p.v. via parameters: die zouden ongebruikt
    // zijn, en de lint-regel maakt daar (terecht) een fout van.
    const haal = vi.fn<(pad: string, opties: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", haal);

    const { meldFout } = await verseModule();
    meldFout({ bron: "window", bericht: "kapot" });

    expect(haal).toHaveBeenCalledOnce();
    expect(haal.mock.calls[0][1]).toMatchObject({ method: "POST", keepalive: true });
  });

  it("stuurt in ontwikkeling niets weg", async () => {
    vi.stubEnv("PROD", false);
    const stil = vi.spyOn(console, "error").mockImplementation(() => {});
    const { meldFout } = await verseModule();
    meldFout({ bron: "render", bericht: "kapot" });

    expect(beacon).not.toHaveBeenCalled();
    expect(stil).toHaveBeenCalled();
    stil.mockRestore();
  });
});

describe("initFoutrapportage", () => {
  it("vangt een fout buiten de render", async () => {
    const { initFoutrapportage } = await verseModule();
    const stop = initFoutrapportage();

    window.dispatchEvent(
      new ErrorEvent("error", { message: "boem", error: new Error("boem") }),
    );
    expect((await payload()).bron).toBe("window");

    stop();
    // Zonder luisteraar rapporteert jsdom een error-event als onafgevangen
    // uitzondering, en dan faalt de hele run. preventDefault markeert hem als
    // afgehandeld — precies wat een echte pagina met een handler ook doet.
    const slik = (e: Event) => e.preventDefault();
    window.addEventListener("error", slik);
    window.dispatchEvent(new ErrorEvent("error", { message: "later", error: new Error("later") }));
    window.removeEventListener("error", slik);
    expect(beacon).toHaveBeenCalledOnce();
  });

  it("vangt een afgewezen promise", async () => {
    const { initFoutrapportage } = await verseModule();
    const stop = initFoutrapportage();

    // jsdom kent PromiseRejectionEvent niet; het event nabootsen volstaat,
    // want de listener leest alleen `reason`.
    const e = new Event("unhandledrejection") as Event & { reason?: unknown };
    e.reason = new Error("afgewezen");
    window.dispatchEvent(e);

    expect(await payload()).toMatchObject({ bron: "promise", bericht: "afgewezen" });
    stop();
  });

  it("negeert een mislukte afbeelding — dat is geen crash", async () => {
    const { initFoutrapportage } = await verseModule();
    const stop = initFoutrapportage();

    const img = document.createElement("img");
    document.body.append(img);
    const e = new ErrorEvent("error", { message: "" });
    Object.defineProperty(e, "target", { value: img });
    window.dispatchEvent(e);

    expect(beacon).not.toHaveBeenCalled();
    img.remove();
    stop();
  });
});
