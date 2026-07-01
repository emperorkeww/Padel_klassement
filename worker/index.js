// Cloudflare Worker die de static assets serveert én als proxy naar Playtomic
// dient. De browser mag Playtomic niet rechtstreeks aanroepen (geen CORS), dus
// /api/playtomic/* wordt hier server-side doorgestuurd naar api.playtomic.io.
//
// Alle overige paden gaan naar de static assets (met SPA-fallback uit
// wrangler.jsonc: not_found_handling = "single-page-application").

const UPSTREAM = "https://api.playtomic.io";
const PREFIX = "/api/playtomic";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(PREFIX)) {
      // Alleen leesverzoeken toestaan; dit is een publieke, read-only proxy.
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      const target = new URL(
        url.pathname.slice(PREFIX.length) + url.search,
        UPSTREAM,
      );
      const upstream = await fetch(target, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8",
          // Playtomic's WAF weigert (403) verzoeken zonder browser-achtige
          // User-Agent vanaf datacenter-IP's zoals die van Cloudflare Workers.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        },
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          // Kort cachen: beschikbaarheid verandert continu.
          "cache-control": "public, max-age=60",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};