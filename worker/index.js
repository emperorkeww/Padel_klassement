// Cloudflare Worker die de static assets serveert én als proxy naar Playtomic
// dient. De browser mag Playtomic niet rechtstreeks aanroepen (geen CORS), dus
// /api/playtomic/* wordt hier server-side doorgestuurd naar api.playtomic.io.
//
// Alle overige paden gaan naar de static assets (met SPA-fallback uit
// wrangler.jsonc: not_found_handling = "single-page-application").

const UPSTREAM = "https://api.playtomic.io";
const PREFIX = "/api/playtomic";

// Alleen de endpoints die de app echt nodig heeft zijn bereikbaar via de
// proxy. Zonder allowlist kan een pad als "//evil.com/x" (protocol-relatief)
// de URL-resolutie naar een ander domein sturen en wordt dit een open proxy.
const ALLOWED_PATHS = [
  /^\/v1\/availability$/,
  // Detail (clubgegevens) én zoeken op naam voor de locatiekeuze.
  /^\/v1\/tenants$/,
  /^\/v1\/tenants\/[\w-]+$/,
];

// Stale-while-revalidate: tot FRESH_MS oud wordt een antwoord direct
// geserveerd; daarna nog steeds direct (geen wachttijd voor de bezoeker),
// maar met een verversing op de achtergrond. Na STORE_SECONDS verdwijnt het
// uit de edge-cache en wacht de eerstvolgende bezoeker weer op Playtomic.
const FRESH_MS = 60_000;
const STORE_SECONDS = 600;

function fetchUpstream(target) {
  return fetch(target, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8",
      // Playtomic's WAF weigert (403) verzoeken zonder browser-achtige
      // User-Agent vanaf datacenter-IP's zoals die van Cloudflare Workers.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    },
  });
}

// Vorm waarin een upstream-antwoord de edge-cache in gaat: lange TTL voor de
// cache zelf, met een tijdstempel om "vers" van "verouderd" te onderscheiden.
async function storedResponse(upstream) {
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${STORE_SECONDS}`,
      "x-fetched-at": String(Date.now()),
    },
  });
}

// De browser mag zelf niets cachen: de edge-cache is de enige waarheid,
// anders stapelen er twee verouderingslagen op elkaar.
function clientResponse(stored) {
  const res = new Response(stored.body, stored);
  res.headers.set("cache-control", "no-store");
  res.headers.delete("x-fetched-at");
  return res;
}

async function refreshInBackground(cache, cacheKey, target) {
  try {
    const upstream = await fetchUpstream(target);
    if (upstream.ok) await cache.put(cacheKey, await storedResponse(upstream));
  } catch {
    // Stil laten mislukken; de volgende bezoeker triggert een nieuwe poging.
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(PREFIX)) {
      // Alleen leesverzoeken toestaan; dit is een publieke, read-only proxy.
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      const rest = url.pathname.slice(PREFIX.length);
      if (!ALLOWED_PATHS.some((re) => re.test(rest))) {
        return new Response("Not Found", { status: 404 });
      }

      const target = new URL(rest + url.search, UPSTREAM);
      if (target.origin !== UPSTREAM) {
        return new Response("Bad Request", { status: 400 });
      }

      // Edge-cache eerst: gelijktijdige gebruikers delen zo één upstream-call
      // en een edge-hit kost geen rate-limit-budget en geen Playtomic-verkeer.
      const cache = caches.default;
      const cacheKey = new Request(target.toString());
      const hit = await cache.match(cacheKey);
      if (hit) {
        const fetchedAt = Number(hit.headers.get("x-fetched-at") ?? 0);
        if (Date.now() - fetchedAt > FRESH_MS) {
          ctx.waitUntil(refreshInBackground(cache, cacheKey, target));
        }
        return clientResponse(hit);
      }

      // Per-IP rate limiting tegen misbruik van de publieke proxy —
      // alleen cache-misses tellen mee.
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      const { success } = await env.PLAYTOMIC_RL.limit({ key: ip });
      if (!success) {
        return new Response("Too Many Requests", {
          status: 429,
          headers: { "retry-after": "10" },
        });
      }

      const upstream = await fetchUpstream(target);
      const stored = await storedResponse(upstream);
      // Alleen geslaagde antwoorden de edge-cache in; fouten blijven vers.
      if (upstream.ok) {
        ctx.waitUntil(cache.put(cacheKey, stored.clone()));
      }
      return clientResponse(stored);
    }

    return env.ASSETS.fetch(request);
  },
};
