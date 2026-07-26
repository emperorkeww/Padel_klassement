import { describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

// public/sw.js wordt verbatim naar dist/ gekopieerd (Vite verwerkt het niet),
// dus we kunnen het niet importeren. In plaats daarvan draaien we de bron in
// een nep-worker-scope: de SW gebruikt self/caches/fetch/Request/Response als
// globals, en als functieparameters schaduwen onze fakes die netjes.
const pad = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const SW_BRON = readFileSync(pad("../../../public/sw.js"), "utf8");

type Fetcher = (req: FakeRequest) => Promise<FakeResponse>;

class FakeRequest {
  headers: { has: (naam: string) => boolean };
  constructor(
    public url: string,
    init: { headers?: Record<string, string>; mode?: string; method?: string } = {},
  ) {
    const headers = init.headers ?? {};
    this.headers = { has: (naam) => naam.toLowerCase() in headers };
    this.mode = init.mode ?? "no-cors";
    this.method = init.method ?? "GET";
  }
  mode: string;
  method: string;
}

class FakeResponse {
  constructor(
    public body: string,
    public status = 200,
  ) {}
  get ok() {
    return this.status >= 200 && this.status < 300;
  }
  clone() {
    return new FakeResponse(this.body, this.status);
  }
  async text() {
    return this.body;
  }
  async json() {
    return JSON.parse(this.body);
  }
  static error() {
    return new FakeResponse("", 0);
  }
}

const sleutel = (k: FakeRequest | string) => (typeof k === "string" ? k : k.url);

class FakeCache {
  entries = new Map<string, FakeResponse>();
  async put(k: FakeRequest | string, res: FakeResponse) {
    // Spiegelt de echte Cache API: een partieel antwoord wordt geweigerd.
    if (res.status === 206) throw new TypeError("Partial response not allowed");
    this.entries.set(sleutel(k), res);
  }
  async match(k: FakeRequest | string) {
    return this.entries.get(sleutel(k));
  }
  async keys() {
    return [...this.entries.keys()];
  }
  async delete(k: FakeRequest | string) {
    return this.entries.delete(sleutel(k));
  }
}

const ORIGIN = "https://vamos.test";

const MANIFEST = {
  "index.html": {
    file: "assets/index-aaa.js",
    css: ["assets/index-aaa.css"],
  },
  "src/routes/Leaderboard.tsx": { file: "assets/Leaderboard-bbb.js" },
  "src/app/index.css": { file: "assets/index-ccc.css" },
  "src/assets/fonts/outfit-latin-wght.woff2": {
    file: "assets/outfit-latin-wght-ddd.woff2",
  },
  "src/features/coach/rudi-mild-2.png": { file: "assets/rudi-mild-2-eee.png" },
  "src/features/dictator/anthem.mp3": {
    file: "assets/km_dictator_anthem-fff.mp3",
  },
};

/** Draait public/sw.js in een nep-scope en geeft de haakjes terug om de
 *  install/activate/fetch-listeners aan te sturen. */
function laadSw(opties: { fetcher?: Fetcher } = {}) {
  const caches = new Map<string, FakeCache>();
  const cacheApi = {
    async open(naam: string) {
      const bestaand = caches.get(naam);
      if (bestaand) return bestaand;
      const vers = new FakeCache();
      caches.set(naam, vers);
      return vers;
    },
    async keys() {
      return [...caches.keys()];
    },
    async delete(naam: string) {
      return caches.delete(naam);
    },
  };

  const standaard: Fetcher = async (req) => {
    if (req.url === "/index.html") return new FakeResponse("<html></html>");
    if (req.url === "/.vite/manifest.json") {
      return new FakeResponse(JSON.stringify(MANIFEST));
    }
    return new FakeResponse("asset");
  };
  const fetcher = vi.fn(opties.fetcher ?? standaard);

  const listeners = new Map<string, (event: unknown) => void>();
  const scope = {
    addEventListener: (type: string, h: (event: unknown) => void) =>
      listeners.set(type, h),
    location: { origin: ORIGIN },
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: { showNotification: async () => {} },
    skipWaiting: () => {},
  };

  new Function(
    "self",
    "caches",
    "fetch",
    "Request",
    "Response",
    SW_BRON,
  )(scope, cacheApi, fetcher, FakeRequest, FakeResponse);

  /** Vuurt een event af en wacht tot alle waitUntil-promises rond zijn. */
  async function vuur(type: string, extra: Record<string, unknown> = {}) {
    const wachtend: Promise<unknown>[] = [];
    let antwoord: Promise<FakeResponse> | undefined;
    listeners.get(type)?.({
      waitUntil: (p: Promise<unknown>) => wachtend.push(p),
      respondWith: (p: Promise<FakeResponse>) => {
        antwoord = p;
      },
      ...extra,
    });
    await Promise.all(wachtend);
    const res = antwoord ? await antwoord : undefined;
    // Een put in waitUntil kan ná respondWith geregistreerd zijn.
    await Promise.all(wachtend);
    return res;
  }

  const cacheNaam = (voorvoegsel: string) =>
    [...caches.keys()].find((k) => k.startsWith(voorvoegsel)) ?? "";
  const inhoud = (voorvoegsel: string) => [
    ...(caches.get(cacheNaam(voorvoegsel))?.entries.keys() ?? []),
  ];

  return { caches, cacheApi, fetcher, vuur, cacheNaam, inhoud };
}

const haal = (sw: ReturnType<typeof laadSw>, url: string, init = {}) =>
  sw.vuur("fetch", { request: new FakeRequest(url, init) });

describe("service worker: precache", () => {
  it("cachet alleen de app-shell vooraf — geen media (#730)", async () => {
    const sw = laadSw();
    await sw.vuur("install");

    const assets = sw.inhoud("vamos-assets");
    expect(assets).toEqual(
      expect.arrayContaining([
        "/favicon.svg",
        "/manifest.webmanifest",
        "/assets/index-aaa.js",
        "/assets/index-aaa.css",
        "/assets/Leaderboard-bbb.js",
        "/assets/index-ccc.css",
        // Fonts horen bij de shell: index.css haalt ze via url() binnen, dus
        // zonder precache start de eerste offline sessie in een fallback-font.
        "/assets/outfit-latin-wght-ddd.woff2",
      ]),
    );
    expect(assets).not.toContain("/assets/rudi-mild-2-eee.png");
    expect(assets).not.toContain("/assets/km_dictator_anthem-fff.mp3");
  });

  it("laat één mislukte asset de rest niet meeslepen", async () => {
    const sw = laadSw({
      fetcher: async (req) => {
        if (req.url === "/index.html") return new FakeResponse("<html></html>");
        if (req.url === "/.vite/manifest.json") {
          return new FakeResponse(JSON.stringify(MANIFEST));
        }
        if (req.url === "/assets/Leaderboard-bbb.js") {
          throw new TypeError("network hiccup");
        }
        return new FakeResponse("asset");
      },
    });
    await sw.vuur("install");

    const assets = sw.inhoud("vamos-assets");
    expect(assets).not.toContain("/assets/Leaderboard-bbb.js");
    expect(assets).toContain("/assets/index-aaa.js");
    expect(sw.inhoud("vamos-shell")).toContain("/index.html");
  });

  it("filtert ook de terugvallijst uit de shell-HTML", async () => {
    const sw = laadSw({
      fetcher: async (req) => {
        if (req.url === "/index.html") {
          return new FakeResponse(
            '<html><script src="/assets/index-aaa.js"></script>' +
              '<img src="/assets/rudi-mild-2-eee.png"></html>',
          );
        }
        if (req.url === "/.vite/manifest.json") return new FakeResponse("", 404);
        return new FakeResponse("asset");
      },
    });
    await sw.vuur("install");

    expect(sw.inhoud("vamos-assets")).toContain("/assets/index-aaa.js");
    expect(sw.inhoud("vamos-assets")).not.toContain("/assets/rudi-mild-2-eee.png");
  });
});

describe("service worker: runtime-caching", () => {
  it("zet gehashte media in een cache die een release overleeft", async () => {
    const sw = laadSw();
    await haal(sw, `${ORIGIN}/assets/km_dictator_anthem-fff.mp3`);

    expect(sw.inhoud("vamos-media")).toEqual([
      `${ORIGIN}/assets/km_dictator_anthem-fff.mp3`,
    ]);
    expect(sw.cacheNaam("vamos-media")).toBe("vamos-media");
  });

  it("houdt niet-gehashte publieke bestanden in de geversioneerde cache", async () => {
    const sw = laadSw();
    await haal(sw, `${ORIGIN}/icon-192.png`);

    expect(sw.inhoud("vamos-assets")).toEqual([`${ORIGIN}/icon-192.png`]);
    expect(sw.inhoud("vamos-media")).toEqual([]);
  });

  it("cachet geen partieel antwoord op een Range-verzoek", async () => {
    // <audio> vraagt de MP3's met een Range-header op; cache.put() weigert dat
    // partiële antwoord. Zonder guard belandt die afwijzing in waitUntil — hier
    // laat de fake-cache hem net zo hard klappen als de echte.
    const sw = laadSw({
      fetcher: async () => new FakeResponse("bytes", 206),
    });
    const url = `${ORIGIN}/assets/km_dictator_anthem-fff.mp3`;
    const res = await haal(sw, url, { headers: { range: "bytes=0-" } });

    expect(res?.status).toBe(206);
    expect(sw.inhoud("vamos-media")).toEqual([]);
    expect(sw.inhoud("vamos-assets")).toEqual([]);
  });

  it("begrenst de media-cache en gooit de oudste er als eerste uit", async () => {
    const sw = laadSw();
    for (let i = 0; i < 42; i++) {
      await haal(sw, `${ORIGIN}/assets/foto-${i}.png`);
    }

    const media = sw.inhoud("vamos-media");
    expect(media).toHaveLength(40);
    expect(media).not.toContain(`${ORIGIN}/assets/foto-0.png`);
    expect(media).toContain(`${ORIGIN}/assets/foto-41.png`);
  });

  it("ruimt oude versiecaches op maar laat de media-cache staan", async () => {
    const sw = laadSw();
    await sw.vuur("install");
    await haal(sw, `${ORIGIN}/assets/km_dictator_anthem-fff.mp3`);
    await sw.cacheApi.open("vamos-assets-oud");
    await sw.vuur("activate");

    expect([...sw.caches.keys()]).toContain("vamos-media");
    expect([...sw.caches.keys()]).not.toContain("vamos-assets-oud");
  });
});

// De echte build als vangnet: het manifest bevat óók elke geïmporteerde PNG en
// MP3, dus zonder filter groeit de precache mee met de illustraties (#730 begon
// op 30,3 MB). Draait alleen ná een build; CI bouwt vóór `npm test`.
const DIST = pad("../../../dist");
describe.skipIf(!existsSync(`${DIST}/.vite/manifest.json`))(
  "service worker: precache-budget",
  () => {
    it("blijft onder 3 MB", () => {
      const manifest: Record<string, { file?: string; css?: string[] }> =
        JSON.parse(readFileSync(`${DIST}/.vite/manifest.json`, "utf8"));
      // Zelfde filter als public/sw.js — één bron van waarheid is niet mogelijk
      // (de SW is geen module), dus de regex staat hier bewust letterlijk.
      const filter = /\.(?:js|css|woff2?)$/;
      const bestanden = new Set<string>();
      for (const entry of Object.values(manifest)) {
        if (entry.file && filter.test(entry.file)) bestanden.add(entry.file);
        for (const css of entry.css ?? []) bestanden.add(css);
      }

      const bytes = [...bestanden]
        .map((f) => `${DIST}/${f}`)
        .filter((p) => existsSync(p))
        .reduce((som, p) => som + statSync(p).size, 0);

      expect(bestanden.size).toBeGreaterThan(0);
      expect(bytes / 1024 / 1024).toBeLessThan(3);
    });
  },
);
