// Service worker voor offline-ondersteuning van de app-shell.
//
// Strategie (bewust conservatief voor een Supabase-SPA):
//  - Navigaties (HTML): network-first, val offline terug op de gecachte shell.
//  - Same-origin statische assets (gehasht/immutable): cache-first.
//  - Vooraf cachen we alléén de shell (JS/CSS/fonts); zware media komt pas in
//    de cache zodra iemand ze echt opvraagt, in een eigen cache (#730).
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

// Wat gaat er vooraf in de cache? Alleen de app-shell: code, stijl en de
// zelfgehoste fonts (die haalt index.css via url() binnen, dus zonder precache
// start de eerste offline sessie in een fallback-font). Media blijft er bewust
// buiten: het Vite-manifest bevat óók elke geïmporteerde PNG en MP3, en die
// samen zijn ~29 van de 30 MB. Die haalt niemand ongevraagd binnen (#730).
const PRECACHE_RE = /\.(?:js|css|woff2?)$/;

// Gehashte media uit /assets/: content-adresseerbaar, dus veilig om buiten de
// geversioneerde caches te bewaren. Zo overleeft het volkslied van 4,4 MB een
// release i.p.v. bij elke deploy opnieuw over de lijn te komen (#730).
const MEDIA_RE = /^\/assets\/.+\.(?:mp3|ogg|wav|m4a|png|jpe?g|webp|avif|gif)$/;
const MEDIA_CACHE = "vamos-media";
// Ruime bovengrens tegen een vollopend storage-quota (krap op iOS).
const MEDIA_MAX_ENTRIES = 40;

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
            if (entry.file && PRECACHE_RE.test(entry.file)) {
              urls.add(`/${entry.file}`);
            }
            for (const css of entry.css ?? []) urls.add(`/${css}`);
          }
        } else {
          // Terugval: in elk geval de assets uit de shell-HTML.
          const html = await res.clone().text();
          for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
            if (PRECACHE_RE.test(m[1])) urls.add(m[1]);
          }
        }

        // Bewust géén addAll(): dat is atomair, dus één mislukte fetch (flaky
        // verbinding, tunnel) laat de hele precache stil falen en de app is
        // dan alsnog niet offline-bruikbaar. Per bestand cachen laat de rest
        // gewoon staan; wat mist, vult de runtime-cache later aan.
        const assets = await caches.open(ASSET_CACHE);
        await Promise.allSettled(
          [...urls].map(async (u) => {
            const asset = await fetch(new Request(u, { cache: "reload" }));
            if (asset.ok) await assets.put(u, asset);
          }),
        );
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
      const keep = new Set([SHELL_CACHE, ASSET_CACHE, MEDIA_CACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)),
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
      // Meldingen over dezelfde gebeurtenis vervangen elkaar (#189): vier
      // rondes die in één klap klaargezet worden (#827) of een tweede
      // poll-herinnering laten zo één melding achter in plaats van een stapel.
      // renotify: toch trillen/piepen bij de vervanging — anders vervangt een
      // nieuwere melding de oude in stilte. Zonder tag is renotify ongeldig.
      ...(data.tag ? { tag: data.tag, renotify: true } : {}),
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
      // Kijk naar wélk venster het is (#1273). Tot dan pakte deze lus het
      // eerste het beste en navigeerde dat weg: stond je in een ander tabblad
      // een score in te vullen of een poll te bewerken, dan was die invoer weg.
      // En een venster dat al op de doel-URL stond werd niet herkend.
      const doel = new URL(url, self.location.origin);
      const zelfdePad = windows.find((c) => {
        try {
          return new URL(c.url).pathname === doel.pathname;
        } catch {
          return false;
        }
      });
      // 1. Staat het al op de goede plek? Alleen naar voren halen. De
      //    querystring negeren we bewust: dezelfde pagina met een ander filter
      //    is nog steeds de pagina waar je heen wilde.
      if (zelfdePad && "focus" in zelfdePad) {
        await zelfdePad.focus();
        return;
      }
      // 2. Anders een venster van deze app, en dáár naartoe navigeren.
      const eigen = windows.find((c) => {
        try {
          return new URL(c.url).origin === doel.origin && "focus" in c;
        } catch {
          return false;
        }
      });
      if (eigen) {
        await eigen.focus();
        if ("navigate" in eigen) await eigen.navigate(url);
        return;
      }
      // 3. Niets open: nieuw venster.
      await self.clients.openWindow(url);
    })(),
  );
});

/* Een verlopen abonnement ging stil dood (#1273).

   Chrome en Firefox roteren het endpoint periodiek. Zonder handler verliest de
   browser zijn abonnement, blijft de oude rij in push_subscriptions staan tot
   een verzending 404/410 oplevert — de enige opruiming die er is — en leest de
   schakelaar in de instellingen ondertussen de brówser en niet de databank. Die
   staat dus "aan" terwijl er niets meer aankomt.

   Deze handler doet het halve werk: meteen opnieuw abonneren met de sleutel van
   het oude abonnement, zodat het toestel bereikbaar blijft. Het wegschrijven
   doet de app bij de eerstvolgende opening (zelfheling in de meldingenkaart):
   een service worker heeft geen sessie, dus hij zou een edge function zónder
   JWT nodig hebben die op het oude endpoint een rij omwisselt — extra
   aanvalsoppervlak voor een gat dat binnen één app-opening toch dicht gaat.
   Deze gebeurtenis vuurt in de praktijk bovendien zelden. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const sleutel = event.oldSubscription?.options?.applicationServerKey;
      if (!sleutel || event.newSubscription) return;
      await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: sleutel,
      });
    })().catch(() => {
      /* Stil: dit draait zonder gebruiker in beeld. */
    }),
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
  // Gehashte media gaat naar de ongeversioneerde MEDIA_CACHE, zodat een release
  // een al gedownload volkslied niet weggooit. Niet-gehashte publieke bestanden
  // (/icon-192.png, /playtomic-logo.svg) blijven bewust in de geversioneerde
  // asset-cache: die moeten bij een deploy juist wél verversen.
  const media = MEDIA_RE.test(url.pathname);
  event.respondWith(
    (async () => {
      const cache = await caches.open(media ? MEDIA_CACHE : ASSET_CACHE);
      // ignoreVary: de server stuurt `Vary: Origin` op assets, waardoor de
      // crossorigin-requests van de parser (mét Origin-header) anders nooit
      // matchen met wat de install-stap (zónder Origin) heeft gecachet —
      // precies het verschil tussen "werkt online" en "wit scherm offline".
      // Gehashte assets zijn immutable, dus Vary negeren is hier veilig.
      const cached = await cache.match(request, { ignoreVary: true });
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        // 206/Range overslaan: <audio> vraagt de MP3's met een Range-header op
        // en cache.put() weigert een partieel antwoord (TypeError). Zonder deze
        // guard belandt die afwijzing ongemerkt in waitUntil.
        const cacheable =
          fresh.ok && fresh.status !== 206 && !request.headers.has("range");
        // waitUntil: de put moet ook afronden als het antwoord al terug is,
        // anders kan de SW stoppen vóór het chunk echt in de cache zit.
        if (cacheable) {
          event.waitUntil(
            cache
              .put(request, fresh.clone())
              .then(() => (media ? trimMedia(cache) : undefined))
              .catch(() => {
                /* cachen is best effort; het antwoord is al onderweg */
              }),
          );
        }
        return fresh;
      } catch {
        return cached ?? Response.error();
      }
    })(),
  );
});

/** Houdt de media-cache begrensd: Cache.keys() geeft invoegvolgorde, dus de
 *  oudste entries gaan er als eerste uit. */
async function trimMedia(cache) {
  const keys = await cache.keys();
  const overschot = keys.length - MEDIA_MAX_ENTRIES;
  if (overschot <= 0) return;
  await Promise.all(keys.slice(0, overschot).map((k) => cache.delete(k)));
}