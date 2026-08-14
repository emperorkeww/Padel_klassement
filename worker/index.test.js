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

// Clubs zoeken op naam (#391). De Worker fetcht hier bewust niet zelf: de
// zoekpagina weert Cloudflare-egress, dus alles loopt via CLUB_SEARCH_EGRESS.
describe("Worker clubzoeker (/api/playtomic/club-search)", () => {
  const zoekEnv = (extra = {}) => ({
    ...makeEnv(),
    CLUB_SEARCH_EGRESS: "https://x.supabase.co/functions/v1/club-search",
    CRON_SECRET: "topsecret",
    ...extra,
  });
  const treffers = () =>
    new Response(JSON.stringify({ clubs: [{ id: "a1", name: "Hangar Padel Club" }] }), {
      status: 200,
    });

  it("stuurt de genormaliseerde zoekterm naar de egress-hop, mét geheim", async () => {
    const upstream = vi.fn(treffers);
    vi.stubGlobal("fetch", upstream);
    const res = await worker.fetch(
      req("https://app.test/api/playtomic/club-search?q=%20Hangar%20%20Padel%20"),
      zoekEnv(),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clubs: [{ id: "a1", name: "Hangar Padel Club" }] });
    expect(String(upstream.mock.calls[0][0])).toBe(
      "https://x.supabase.co/functions/v1/club-search?q=hangar%20padel",
    );
    expect(upstream.mock.calls[0][1]?.headers?.["x-cron-secret"]).toBe("topsecret");
  });

  it("cachet op de genormaliseerde zoekterm: 'LAGO  Beveren' is een edge-hit op 'lago beveren'", async () => {
    const upstream = vi.fn(treffers);
    vi.stubGlobal("fetch", upstream);
    const env = zoekEnv();
    const puts = [];
    const waitCtx = { waitUntil: (p) => puts.push(p) };
    await worker.fetch(req("https://app.test/api/playtomic/club-search?q=lago%20beveren"), env, waitCtx);
    await Promise.all(puts);
    const res2 = await worker.fetch(
      req("https://app.test/api/playtomic/club-search?q=LAGO%20%20Beveren"),
      env,
      waitCtx,
    );
    expect(res2.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(store.has("https://playtomic.com/search?q=lago%20beveren#clubs")).toBe(true);
  });

  it("cachet een mislukte zoekopdracht niet", async () => {
    const upstream = vi.fn(async () => new Response(JSON.stringify({ error: "uitgeschakeld" }), { status: 503 }));
    vi.stubGlobal("fetch", upstream);
    const env = zoekEnv();
    const puts = [];
    const waitCtx = { waitUntil: (p) => puts.push(p) };
    const res = await worker.fetch(req("https://app.test/api/playtomic/club-search?q=lago"), env, waitCtx);
    await Promise.all(puts);
    expect(res.status).toBe(503);
    expect(store.size).toBe(0);
  });

  it("weigert een te korte of te lange zoekterm zonder upstream-call", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const kort = await worker.fetch(req("https://app.test/api/playtomic/club-search?q=a"), zoekEnv(), ctx);
    const lang = await worker.fetch(
      req(`https://app.test/api/playtomic/club-search?q=${"a".repeat(61)}`),
      zoekEnv(),
      ctx,
    );
    expect(kort.status).toBe(400);
    expect(lang.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  // Zonder egress-hop of geheim is de route onbruikbaar: rechtstreeks fetchen
  // geeft 403 vanaf een Worker-IP (#385). Dan liever eerlijk 503 dan een lege
  // lijst die "jouw club bestaat niet" suggereert.
  it("geeft 503 zonder egress-hop of geheim, en fetcht niets", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const zonderHop = await worker.fetch(
      req("https://app.test/api/playtomic/club-search?q=lago"),
      makeEnv(),
      ctx,
    );
    const zonderGeheim = await worker.fetch(
      req("https://app.test/api/playtomic/club-search?q=lago"),
      zoekEnv({ CRON_SECRET: undefined }),
      ctx,
    );
    expect(zonderHop.status).toBe(503);
    expect(zonderGeheim.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("geeft 429 als de rate-limiter blokkeert", async () => {
    const upstream = vi.fn(treffers);
    vi.stubGlobal("fetch", upstream);
    const env = { ...zoekEnv(), PLAYTOMIC_RL: { limit: vi.fn(async () => ({ success: false })) } };
    const res = await worker.fetch(req("https://app.test/api/playtomic/club-search?q=lago"), env, ctx);
    expect(res.status).toBe(429);
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe("Worker crashmeldingen (/api/client-error)", () => {
  const melding = (init) =>
    new Request("https://app.test/api/client-error", { method: "POST", ...init });

  function foutEnv({ allow = true } = {}) {
    return { ...makeEnv(), FOUT_RL: { limit: vi.fn(async () => ({ success: allow })) } };
  }

  it("neemt een melding aan en logt hem", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = JSON.stringify({ bron: "render", bericht: "kapot" });
    const res = await worker.fetch(melding({ body }), foutEnv(), ctx);

    expect(res.status).toBe(204);
    expect(log).toHaveBeenCalledWith("client-error", body);
    log.mockRestore();
  });

  it("weigert niet-POST met 405", async () => {
    const res = await worker.fetch(
      new Request("https://app.test/api/client-error"),
      foutEnv(),
      ctx,
    );
    expect(res.status).toBe(405);
  });

  it("weigert een te grote body met 413", async () => {
    const res = await worker.fetch(
      melding({ body: "x".repeat(9000), headers: { "content-length": "9000" } }),
      foutEnv(),
      ctx,
    );
    expect(res.status).toBe(413);
  });

  it("kapt ook af zonder content-length", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await worker.fetch(melding({ body: "x".repeat(9000) }), foutEnv(), ctx);
    expect(log.mock.calls[0][1].length).toBe(8192);
    log.mockRestore();
  });

  it("geeft 429 als de eigen rate-limiter blokkeert", async () => {
    const res = await worker.fetch(melding({ body: "{}" }), foutEnv({ allow: false }), ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });

  it("gebruikt een eigen budget, los van de Playtomic-proxy", async () => {
    const env = foutEnv();
    await worker.fetch(melding({ body: "{}" }), env, ctx);
    expect(env.FOUT_RL.limit).toHaveBeenCalled();
    expect(env.PLAYTOMIC_RL.limit).not.toHaveBeenCalled();
  });

  it("logt niets bij een lege body", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await worker.fetch(melding({ body: "" }), foutEnv(), ctx);
    expect(res.status).toBe(204);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

// Doorgifte naar de edge function die de melding bewaart (#1049). Tot dan
// eindigde alles hier als logregel; die blijft, maar is niet langer het enige.
describe("Worker crashmeldingen doorgeven aan client-error (#1049)", () => {
  const melding = (init) =>
    new Request("https://app.test/api/client-error", { method: "POST", ...init });

  function sinkEnv(over = {}) {
    return {
      ...makeEnv(),
      FOUT_RL: { limit: vi.fn(async () => ({ success: true })) },
      FOUT_SINK: "https://db.test/functions/v1/client-error",
      CRON_SECRET: "geheim",
      ...over,
    };
  }

  /** ctx.waitUntil vangt de belofte op; de test moet erop kunnen wachten. */
  function vangCtx() {
    const beloftes = [];
    return { ctx: { waitUntil: (p) => beloftes.push(p) }, beloftes };
  }

  let log;
  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it("stuurt de melding door met het cron-geheim", async () => {
    const doorgeef = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", doorgeef);
    const { ctx: c, beloftes } = vangCtx();

    const body = JSON.stringify({ bron: "render", bericht: "kapot" });
    const res = await worker.fetch(melding({ body }), sinkEnv(), c);
    await Promise.all(beloftes);

    expect(res.status).toBe(204);
    expect(doorgeef).toHaveBeenCalledTimes(1);
    const [url, init] = doorgeef.mock.calls[0];
    expect(url).toBe("https://db.test/functions/v1/client-error");
    expect(init.method).toBe("POST");
    expect(init.headers["x-cron-secret"]).toBe("geheim");
    expect(init.body).toBe(body);
  });

  it("laat de bezoeker niet op de databank wachten", async () => {
    // De doorgifte lost nooit op; de 204 moet er tóch meteen zijn.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { ctx: c } = vangCtx();

    const res = await worker.fetch(
      melding({ body: JSON.stringify({ bericht: "traag" }) }),
      sinkEnv(),
      c,
    );
    expect(res.status).toBe(204);
  });

  it("blijft 204 geven als het doorgeven faalt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("supabase plat");
    }));
    const { ctx: c, beloftes } = vangCtx();

    const res = await worker.fetch(
      melding({ body: JSON.stringify({ bericht: "kapot" }) }),
      sinkEnv(),
      c,
    );
    await Promise.all(beloftes);

    expect(res.status).toBe(204);
    // En het valt op in de logs in plaats van stil te verdwijnen.
    expect(log.mock.calls.some((c) => String(c[0]).includes("doorgeven mislukte"))).toBe(true);
  });

  it("valt terug op alleen loggen zonder sink of geheim", async () => {
    const doorgeef = vi.fn();
    vi.stubGlobal("fetch", doorgeef);
    const { ctx: c } = vangCtx();
    const body = JSON.stringify({ bericht: "kapot" });

    await worker.fetch(melding({ body }), sinkEnv({ FOUT_SINK: undefined }), c);
    await worker.fetch(melding({ body }), sinkEnv({ CRON_SECRET: undefined }), c);

    expect(doorgeef).not.toHaveBeenCalled();
    // De logregel van #733 staat er nog steeds.
    expect(log).toHaveBeenCalledWith("client-error", body);
  });

  it("geeft een lege body niet door", async () => {
    const doorgeef = vi.fn();
    vi.stubGlobal("fetch", doorgeef);
    const { ctx: c } = vangCtx();

    await worker.fetch(melding({ body: "" }), sinkEnv(), c);
    expect(doorgeef).not.toHaveBeenCalled();
  });

  it("geeft de afgekapte body door, niet het origineel", async () => {
    const doorgeef = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", doorgeef);
    const { ctx: c, beloftes } = vangCtx();

    await worker.fetch(melding({ body: "x".repeat(9000) }), sinkEnv(), c);
    await Promise.all(beloftes);

    expect(doorgeef.mock.calls[0][1].body.length).toBe(8192);
  });
});
