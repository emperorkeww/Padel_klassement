import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index.js";

// Minimale stubs voor de Worker-runtime: een in-memory edge-cache, een
// rate-limiter die standaard toestaat, en een ASSETS-binding.
function makeEnv({ allow = true } = {}) {
  return {
    ASSETS: { fetch: vi.fn(async () => new Response("asset", { status: 200 })) },
    PLAYTOMIC_RL: { limit: vi.fn(async () => ({ success: allow })) },
  };
}

const ctx = { waitUntil: () => {} };
const req = (url, method = "GET") => new Request(url, { method });

let store;
beforeEach(() => {
  store = new Map();
  const cache = {
    match: async (key) => store.get(key instanceof Request ? key.url : String(key)) ?? undefined,
    put: async (key, res) => {
      store.set(key instanceof Request ? key.url : String(key), res);
    },
  };
  vi.stubGlobal("caches", { default: cache });
});
afterEach(() => vi.unstubAllGlobals());

describe("Worker Playtomic-proxy", () => {
  it("weigert een pad buiten de allowlist met 404", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await worker.fetch(req("https://app.test/api/playtomic/v1/tenants/abc"), makeEnv(), ctx);
    expect(res.status).toBe(404);
  });

  it("weigert niet-GET met 405", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await worker.fetch(
      req("https://app.test/api/playtomic/api/clubs/availability?tenant_id=x", "POST"),
      makeEnv(),
      ctx,
    );
    expect(res.status).toBe(405);
  });

  it("proxyt availability naar playtomic.com met de query", async () => {
    const upstream = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    const res = await worker.fetch(
      req("https://app.test/api/playtomic/api/clubs/availability?tenant_id=x&date=2026-07-02&sport_id=PADEL"),
      makeEnv(),
      ctx,
    );
    expect(res.status).toBe(200);
    const target = String(upstream.mock.calls[0][0]);
    expect(target).toBe(
      "https://playtomic.com/api/clubs/availability?tenant_id=x&date=2026-07-02&sport_id=PADEL",
    );
    // Geen gespoofte User-Agent meer.
    const headers = upstream.mock.calls[0][1]?.headers ?? {};
    expect(headers["User-Agent"]).toBeUndefined();
    // Fallback naar playtomic.com: het gedeelde geheim mag hier niet heen (#466).
    expect(headers["x-cron-secret"]).toBeUndefined();
  });

  it("availability: fetcht via de egress-hop met x-cron-secret wanneer PLAYTOMIC_EGRESS is gezet", async () => {
    const upstream = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    const env = {
      ...makeEnv(),
      PLAYTOMIC_EGRESS: "https://x.supabase.co/functions/v1/playtomic-availability",
      CRON_SECRET: "topsecret",
    };
    const res = await worker.fetch(
      req("https://app.test/api/playtomic/api/clubs/availability?tenant_id=x&date=2026-07-02&sport_id=PADEL"),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    // De fetch gaat naar de Edge Function, met dezelfde query.
    expect(String(upstream.mock.calls[0][0])).toBe(
      "https://x.supabase.co/functions/v1/playtomic-availability?tenant_id=x&date=2026-07-02&sport_id=PADEL",
    );
    // …en met het gedeelde geheim als header, zodat de egressfunctie het accepteert (#466).
    expect(upstream.mock.calls[0][1]?.headers?.["x-cron-secret"]).toBe("topsecret");
  });

  it("availability: cache-sleutel blijft canoniek — tweede verzoek is een edge-hit", async () => {
    const upstream = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    const env = {
      ...makeEnv(),
      PLAYTOMIC_EGRESS: "https://x.supabase.co/functions/v1/playtomic-availability",
    };
    const url =
      "https://app.test/api/playtomic/api/clubs/availability?tenant_id=x&date=2026-07-02&sport_id=PADEL";
    // ctx die waitUntil-promises daadwerkelijk afwacht, zodat cache.put landt.
    const puts = [];
    const waitCtx = { waitUntil: (p) => puts.push(p) };
    await worker.fetch(req(url), env, waitCtx);
    await Promise.all(puts);
    const res2 = await worker.fetch(req(url), env, waitCtx);
    expect(res2.status).toBe(200);
    // Eén upstream-call: de tweede kwam uit de edge-cache (gekeyd op de
    // canonieke playtomic.com-URL, niet op de egress-URL).
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(store.has("https://playtomic.com/api/clubs/availability?tenant_id=x&date=2026-07-02&sport_id=PADEL")).toBe(true);
  });

  it("club-slug: volgt de 308 en geeft de slug terug", async () => {
    const upstream = vi.fn(async () =>
      new Response(null, { status: 308, headers: { location: "https://playtomic.com/clubs/lago-club-padel-beveren" } }),
    );
    vi.stubGlobal("fetch", upstream);
    const uuid = "91d8d419-3736-498e-90be-362de786d588";
    const res = await worker.fetch(req(`https://app.test/api/playtomic/club-slug/${uuid}`), makeEnv(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ slug: "lago-club-padel-beveren" });
    expect(String(upstream.mock.calls[0][0])).toBe(`https://playtomic.io/clubs/${uuid}`);
  });

  it("club-slug: 404 als er geen bruikbare redirect is", async () => {
    const uuid = "91d8d419-3736-498e-90be-362de786d588";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    const res = await worker.fetch(req(`https://app.test/api/playtomic/club-slug/${uuid}`), makeEnv(), ctx);
    expect(res.status).toBe(404);
  });

  it("club-slug: 404 op een ongeldig uuid (geen upstream-call)", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const res = await worker.fetch(req("https://app.test/api/playtomic/club-slug/not-a-uuid"), makeEnv(), ctx);
    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("geeft 429 als de rate-limiter blokkeert", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    const res = await worker.fetch(
      req("https://app.test/api/playtomic/api/clubs/availability?tenant_id=x"),
      makeEnv({ allow: false }),
      ctx,
    );
    expect(res.status).toBe(429);
  });

  it("niet-proxy-paden gaan naar de static assets", async () => {
    const env = makeEnv();
    const res = await worker.fetch(req("https://app.test/spelen"), env, ctx);
    expect(res.status).toBe(200);
    expect(env.ASSETS.fetch).toHaveBeenCalled();
  });
});
