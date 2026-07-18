// Service worker voor offline-ondersteuning van de app-shell.
//
// Strategie (bewust conservatief voor een Supabase-SPA):
//  - Navigaties (HTML): network-first, val offline terug op de gecachte shell.
//  - Same-origin statische assets (gehasht/immutable): cache-first.
//  - NOOIT cachen: Supabase (ander origin), de Playtomic-proxy (/api/*),
//    de service worker zelf, en alle niet-GET-verzoeken.
//
// VERSION wordt bij de build ingevuld: vite.config.ts vervangt de placeholder
// hieronder door een hash van het build-manifest, zodat de cacheversie
// automatisch bumpt precies wanneer assets wijzigen — geen handmatige bump meer.
const VERSION = "__SW_VERSION__";
const SHELL_CACHE = `vamos-shell-${VERSION}`;
const ASSET_CACHE = `vamos-assets-${VERSION}`;
const OFFLINE_URL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Shell cachen…
      const shell = await caches.open(SHELL_CACHE);
      const res = await fetch(new Request(OFFLINE_URL, { cache: "reload" }));
      await shell.put(OFFLINE_URL, res.clone());

      // …én alle gehashte JS/CSS direct pre-cachen. Bij het allereerste
      // bezoek laden die assets nog buiten de service worker om, en lazy
      // route-chunks staan niet in de HTML — zonder deze stap opent de app
      // offline met een eeuwige "Laden…". Het Vite-manifest kent élk chunk.
      try {
        const urls = new Set(["/favicon.svg", "/manifest.webmanifest"]);

        const manifestRes = await fetch(
          new Request("/.vite/manifest.json", { cache: "reload" }),
        );
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          for (const entry of Object.values(manifest)) {
            if (entry.file) urls.add(`/${entry.file}`);
            for (const css of entry.css ?? []) urls.add(`/${css}`);
          }
        } else {
          // Terugval: in elk geval de assets uit de shell-HTML.
          const html = await res.clone().text();
          for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
            urls.add(m[1]);
          }
        }

        const assets = await caches.open(ASSET_CACHE);
        await assets.addAll([...urls]);
      } catch {
        // Best effort: runtime-caching vult de rest bij een later bezoek.
      }
    })(),
  );
  // Bewust GÉÉN skipWaiting hier: een nieuwe versie blijft "waiting" tot de
  // gebruiker via de update-toast bewust herlaadt (#463). Zo blijft de open
  // tab op de oude SW draaien en blijven de oude asset-chunks bereikbaar.
});

// De client vraagt om te activeren zodra de gebruiker "herladen" tikt (#463).
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
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

/* ---- Push-meldingen (Edge Function send-push levert de payload) ---- */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    /* geen JSON-payload — toon een kale melding */
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Vamos!", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Bestaand venster hergebruiken; anders een nieuw openen.
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
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
          return (
            (await cache.match(OFFLINE_URL, { ignoreVary: true })) ??
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Statische assets: cache-first (gehasht → nooit stale), anders netwerk + cachen.
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      // ignoreVary: de server stuurt `Vary: Origin` op assets, waardoor de
      // crossorigin-requests van de parser (mét Origin-header) anders nooit
      // matchen met wat de install-stap (zónder Origin) heeft gecachet —
      // precies het verschil tussen "werkt online" en "wit scherm offline".
      // Gehashte assets zijn immutable, dus Vary negeren is hier veilig.
      const cached = await cache.match(request, { ignoreVary: true });
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        // waitUntil: de put moet ook afronden als het antwoord al terug is,
        // anders kan de SW stoppen vóór het chunk echt in de cache zit.
        if (fresh.ok) event.waitUntil(cache.put(request, fresh.clone()));
        return fresh;
      } catch {
        return cached ?? Response.error();
      }
    })(),
  );
});