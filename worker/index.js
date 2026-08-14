// Cloudflare Worker die de static assets serveert én als proxy naar Playtomic
// dient. De browser mag Playtomic niet rechtstreeks aanroepen (geen CORS), dus
// /api/playtomic/* wordt hier server-side doorgestuurd naar playtomic.com.
//
// Historie: tot medio 2026 liep dit via api.playtomic.io met een gespoofte
// browser-User-Agent om de WAF te omzeilen. Die host weigert nu élk verzoek
// (403, ongeacht UA). playtomic.com/api/* werkt wél — maar niet vanaf
// Cloudflare-egress: de CloudFront-WAF blokkeert Worker-IP's (403), terwijl
// Supabase-egress wél doorgelaten wordt (live geverifieerd). De availability-
// fetch loopt daarom via een Supabase Edge Function (env.PLAYTOMIC_EGRESS,
// zie supabase/functions/playtomic-availability). De Worker blijft de
// publieke voorkant: edge-cache, per-IP rate-limit en allowlist. Zie #385.
//
// Alle overige paden gaan naar de static assets (met SPA-fallback uit
// wrangler.jsonc: not_found_handling = "single-page-application").

const UPSTREAM = "https://playtomic.com";
const PREFIX = "/api/playtomic";

// Crashmeldingen uit de browser (#733). Geen database: de melding wordt hier
// een logregel en is daarmee zichtbaar in Workers Logs (observability staat
// aan in wrangler.jsonc). Ruim genoeg voor een stack, klein genoeg om nooit
// zelf een probleem te worden.
const FOUT_PAD = "/api/client-error";
const FOUT_MAX_BYTES = 8192;
// Slug-resolutie loopt via dit host: playtomic.io/clubs/{uuid} stuurt met een
// nette 308 door naar playtomic.com/clubs/{slug} (zie club-slug-route onder).
const SLUG_UPSTREAM = "https://playtomic.io";

// Alleen de endpoints die de app echt nodig heeft zijn bereikbaar via de
// proxy. Zonder allowlist kan een pad als "//evil.com/x" (protocol-relatief)
// de URL-resolutie naar een ander domein sturen en wordt dit een open proxy.
const ALLOWED_PATHS = [/^\/api\/clubs\/availability$/];

// Aparte, niet-proxy-route: /api/playtomic/club-slug/{uuid} lost de club-slug
// op voor de "Reserveren op Playtomic"-deeplink. Het tenant-id werkt niet meer
// als URL-slug; alleen de canonieke slug landt op een werkende clubpagina.
const SLUG_PREFIX = `${PREFIX}/club-slug/`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Slugs zijn de facto onveranderlijk; ruim (een week) edge-cachen.
const SLUG_STORE_SECONDS = 604_800;

// Clubs zoeken op naam (#391). Ook een niet-proxy-route: het antwoord is de
// geparste trefferlijst van de egress-functie, niet een Playtomic-respons.
const ZOEK_PAD = `${PREFIX}/club-search`;
const ZOEK_MIN_LENGTE = 2;
const ZOEK_MAX_LENGTE = 60;
// Clubs komen er zelden bij en verhuizen nog minder vaak; zes uur cachen
// scheelt Playtomic-verkeer zonder dat iemand een verouderde lijst merkt.
const ZOEK_STORE_SECONDS = 21_600;

// Stale-while-revalidate: tot FRESH_MS oud wordt een antwoord direct
// geserveerd; daarna nog steeds direct (geen wachttijd voor de bezoeker),
// maar met een verversing op de achtergrond. Na STORE_SECONDS verdwijnt het
// uit de edge-cache en wacht de eerstvolgende bezoeker weer op Playtomic.
const FRESH_MS = 60_000;
const STORE_SECONDS = 600;

function fetchUpstream(target, secret) {
  // Geen User-Agent meer: playtomic.com/api werkt zonder, en een losse
  // Chrome-UA zonder bijpassende sec-ch-ua-headers is juist een fingerprint
  // die een WAF kan uitpikken.
  const headers = {
    Accept: "application/json",
    "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8",
  };
  // Het gedeelde geheim gaat uitsluitend naar de Supabase-egressfunctie (#466),
  // nooit rechtstreeks naar playtomic.com in de fallback: `secret` is alleen
  // waar op het egress-pad, zodat het geheim niet naar een derde partij lekt.
  if (secret) headers["x-cron-secret"] = secret;
  return fetch(target, { headers });
}

// Volgt de 308 van playtomic.io/clubs/{uuid} en leest de canonieke slug uit de
// Location-header (…/clubs/{slug}). Geeft de slug of null (geen bruikbare
// redirect). redirect:"manual" zodat we de Location zelf kunnen inspecteren.
async function resolveClubSlug(uuid) {
  const res = await fetch(`${SLUG_UPSTREAM}/clubs/${uuid}`, {
    redirect: "manual",
    headers: { "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8" },
  });
  const location = res.headers.get("location");
  if (!location) return null;
  const m = /\/clubs\/([^/?#]+)/.exec(location);
  const slug = m?.[1];
  // Een slug moet iets anders zijn dan het uuid zelf (anders geen echte
  // canonieke doorverwijzing) en geen intern hostfragment bevatten.
  if (!slug || slug === uuid) return null;
  return slug;
}

// Vorm waarin een upstream-antwoord de edge-cache in gaat: lange TTL voor de
// cache zelf, met een tijdstempel om "vers" van "verouderd" te onderscheiden.
async function storedResponse(upstream, storeSeconds = STORE_SECONDS) {
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${storeSeconds}`,
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

async function refreshInBackground(cache, cacheKey, target, secret) {
  try {
    const upstream = await fetchUpstream(target, secret);
    if (upstream.ok) await cache.put(cacheKey, await storedResponse(upstream));
  } catch {
    // Stil laten mislukken; de volgende bezoeker triggert een nieuwe poging.
  }
}

// GET /api/playtomic/club-slug/{uuid} → { "slug": "..." }. Deelt de edge-cache
// en per-IP rate-limit met de proxy; de slug wordt lang gecached (immutabel).
async function handleClubSlug(rawUuid, request, env, ctx) {
  const uuid = rawUuid.toLowerCase();
  if (!UUID_RE.test(uuid)) return new Response("Not Found", { status: 404 });

  const cache = caches.default;
  const cacheKey = new Request(`${SLUG_UPSTREAM}/clubs/${uuid}#slug`);
  const hit = await cache.match(cacheKey);
  if (hit) {
    const res = new Response(hit.body, hit);
    res.headers.set("cache-control", "no-store");
    return res;
  }

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.PLAYTOMIC_RL.limit({ key: ip });
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "retry-after": "10" },
    });
  }

  let slug = null;
  try {
    slug = await resolveClubSlug(uuid);
  } catch {
    // Upstream onbereikbaar — geen slug; de client valt terug op de uuid-URL.
  }
  if (!slug) {
    return new Response(JSON.stringify({ error: "no slug" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const stored = new Response(JSON.stringify({ slug }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${SLUG_STORE_SECONDS}`,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, stored.clone()));
  const res = new Response(stored.body, stored);
  res.headers.set("cache-control", "no-store");
  return res;
}

// GET /api/playtomic/club-search?q=… → { "clubs": [...] } (#391).
//
// Playtomic heeft geen zoek-API meer; de egress-functie club-search leest de
// zoekpagina en geeft de geparste trefferlijst terug. De Worker doet hier wat
// hij bij de andere routes ook doet — normaliseren, cachen, rate-limiten — maar
// fetcht bewust niet zelf: de zoekpagina hangt achter dezelfde WAF die
// Cloudflare-egress weert (#385, #392).
async function handleClubSearch(url, request, env, ctx) {
  // Normaliseren vóór de cache-sleutel: "LAGO  Beveren" en "lago beveren"
  // zijn dezelfde zoekopdracht en horen dezelfde cache-rij te delen.
  const q = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  if (q.length < ZOEK_MIN_LENGTE || q.length > ZOEK_MAX_LENGTE) {
    return new Response(JSON.stringify({ error: "bad query" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // Zonder egress-hop of geheim kán deze route niet werken: rechtstreeks
  // fetchen vanaf een Worker-IP geeft 403 (#385). Dan liever een eerlijke 503
  // dan een lege trefferlijst die "jouw club bestaat niet" suggereert.
  if (!env.CLUB_SEARCH_EGRESS || !env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: "zoeken niet beschikbaar" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const cache = caches.default;
  // Sleutel op de canonieke zoekpagina-URL, niet op de egress-URL: verhuist de
  // hop ooit, dan blijft de cache geldig (zelfde keuze als bij availability).
  const cacheKey = new Request(`${UPSTREAM}/search?q=${encodeURIComponent(q)}#clubs`);
  const hit = await cache.match(cacheKey);
  if (hit) return clientResponse(hit);

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.PLAYTOMIC_RL.limit({ key: ip });
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "retry-after": "10" },
    });
  }

  let upstream;
  try {
    upstream = await fetchUpstream(
      `${env.CLUB_SEARCH_EGRESS}?q=${encodeURIComponent(q)}`,
      env.CRON_SECRET,
    );
  } catch {
    return new Response(JSON.stringify({ error: "upstream unreachable" }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const stored = await storedResponse(upstream, ZOEK_STORE_SECONDS);
  // Alleen geslaagde zoekopdrachten cachen; een 503 van de kill switch of een
  // 502 hoort niet zes uur te blijven plakken.
  if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, stored.clone()));
  return clientResponse(stored);
}

// Neemt een crashmelding van de browser aan (#733) en bewaart hem (#1049).
// Bewust schriel: alleen POST, een harde bovengrens op de body en een eigen
// per-IP rate-limit, want dit is een publiek endpoint zonder authenticatie. Het
// antwoord is altijd 204 — de client heeft er niets aan en mag er ook nooit
// op wachten.
//
// Tot #1049 eindigde de melding hier als console.error: zichtbaar in een live
// `wrangler tail`, weg voor wie een uur later kijkt. Nu gaat hij door naar de
// edge function `client-error`, die hem met de service-role in
// public.client_errors zet.
//
// De doorgifte hangt aan ctx.waitUntil: de bezoeker wacht niet op de databank,
// en zijn 204 valt niet weg als Supabase traag is. De console.error blijft
// staan — als de doorgifte zelf stuk is, is dat de enige plek waar je het ziet.
async function handleClientError(request, env, ctx) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > FOUT_MAX_BYTES) {
    return new Response("Payload Too Large", { status: 413 });
  }

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (env.FOUT_RL) {
    const { success } = await env.FOUT_RL.limit({ key: ip });
    if (!success) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "retry-after": "60" },
      });
    }
  }

  // Ook zónder content-length afkappen: die header is niet gegarandeerd.
  const melding = (await request.text()).slice(0, FOUT_MAX_BYTES);
  if (melding) {
    console.error("client-error", melding);
    // Zonder sink of geheim blijft het bij de logregel — precies het gedrag
    // van vóór #1049, en dus geen reden om de melding te laten vallen.
    if (env.FOUT_SINK && env.CRON_SECRET) {
      const doorgeven = fetch(env.FOUT_SINK, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cron-secret": env.CRON_SECRET,
        },
        body: melding,
      }).catch((e) => {
        // Rapporteren mag nooit zelf een fout opleveren.
        console.error("client-error doorgeven mislukte", e?.message ?? e);
      });
      ctx.waitUntil(doorgeven);
    }
  }
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === FOUT_PAD) {
      return handleClientError(request, env, ctx);
    }

    if (url.pathname.startsWith(PREFIX)) {
      // Alleen leesverzoeken toestaan; dit is een publieke, read-only proxy.
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      // Slug-resolutie voor de reserveerlink. Aparte route omdat het antwoord
      // JSON is ({slug}) en de bron een ander host (playtomic.io) is.
      if (url.pathname.startsWith(SLUG_PREFIX)) {
        return handleClubSlug(url.pathname.slice(SLUG_PREFIX.length), request, env, ctx);
      }

      // Clubs zoeken op naam (#391): eigen route, want het antwoord komt van de
      // egress-functie en niet van een Playtomic-endpoint uit de allowlist.
      if (url.pathname === ZOEK_PAD) {
        return handleClubSearch(url, request, env, ctx);
      }

      const rest = url.pathname.slice(PREFIX.length);
      if (!ALLOWED_PATHS.some((re) => re.test(rest))) {
        return new Response("Not Found", { status: 404 });
      }

      const canonical = new URL(rest + url.search, UPSTREAM);
      if (canonical.origin !== UPSTREAM) {
        return new Response("Bad Request", { status: 400 });
      }

      // Egress-hop (#385): playtomic.com/api geeft 403 aan Cloudflare-IP's,
      // dus de echte fetch loopt via de Supabase Edge Function. De canonieke
      // URL blijft de cache-sleutel, zodat de cache egress-onafhankelijk is.
      // Zonder configuratie (tests, lokaal) valt hij terug op direct fetchen.
      const target = env.PLAYTOMIC_EGRESS
        ? new URL(env.PLAYTOMIC_EGRESS + url.search)
        : canonical;

      // Gedeeld geheim alleen op het egress-pad meesturen (#466). In de
      // fallback (tests/lokaal, geen PLAYTOMIC_EGRESS) fetchen we rechtstreeks
      // playtomic.com en mag het geheim daar niet heen.
      const secret = env.PLAYTOMIC_EGRESS ? env.CRON_SECRET : null;

      // Edge-cache eerst: gelijktijdige gebruikers delen zo één upstream-call
      // en een edge-hit kost geen rate-limit-budget en geen Playtomic-verkeer.
      const cache = caches.default;
      const cacheKey = new Request(canonical.toString());
      const hit = await cache.match(cacheKey);
      if (hit) {
        const fetchedAt = Number(hit.headers.get("x-fetched-at") ?? 0);
        if (Date.now() - fetchedAt > FRESH_MS) {
          ctx.waitUntil(refreshInBackground(cache, cacheKey, target, secret));
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

      const upstream = await fetchUpstream(target, secret);
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
