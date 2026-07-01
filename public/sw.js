// Service worker voor offline-ondersteuning van de app-shell.
//
// Strategie (bewust conservatief voor een Supabase-SPA):
//  - Navigaties (HTML): network-first, val offline terug op de gecachte shell.
//  - Same-origin statische assets (gehasht/immutable): cache-first.
//  - NOOIT cachen: Supabase (ander origin), de Playtomic-proxy (/api/*),
//    de service worker zelf, en alle niet-GET-verzoeken.
//
// Bump VERSION bij een breaking change om oude caches te verversen.
const VERSION = "v1";
const SHELL_CACHE = `vamos-shell-${VERSION}`;
const ASSET_CACHE = `vamos-assets-${VERSION}`;
const OFFLINE_URL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Alleen ons eigen domein cachen. Supabase/Playtomic/API + de SW zelf: netwerk.
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin || url.pathname.startsWith("/api/") || url.pathname === "/sw.js") {
    return;
  }

  // Navigaties: network-first, offline terugvallen op de gecachte shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(OFFLINE_URL, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(OFFLINE_URL)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Statische assets: cache-first (gehasht → nooit stale), anders netwerk + cachen.
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return cached ?? Response.error();
      }
    })(),
  );
});