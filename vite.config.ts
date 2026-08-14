/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import {
  belgischeClubs,
  parseClubs,
  ZOEK_HEADERS,
  ZOEK_MAX_LENGTE,
  ZOEK_MIN_LENGTE,
  zoekUrl,
} from "./supabase/functions/_shared/clubZoeken.ts";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Vult de service-worker-versie in bij de build (#463). public/sw.js wordt
// verbatim naar dist/ gekopieerd (Vite verwerkt het niet), dus vervangen we
// hier de __SW_VERSION__-placeholder door een hash van het build-manifest.
// Zo bumpt de SW-cacheversie automatisch én precies wanneer assets wijzigen:
// geen handmatige VERSION-bump meer, en geen onnodige cache-churn.
function serviceWorkerVersion(): Plugin {
  return {
    name: "service-worker-version",
    apply: "build",
    // closeBundle draait ná het kopiëren van publicDir, dus dist/sw.js bestaat.
    closeBundle() {
      let source: string;
      try {
        source = readFileSync(r("./dist/sw.js"), "utf8");
      } catch {
        return; // geen SW in deze build-output: niets te doen
      }
      // De sw-bron gaat mee in de hash (nog mét placeholder, dus
      // deterministisch): anders houdt een wijziging in de cachestrategie
      // dezelfde cachenamen en blijven bestaande installaties op hun oude,
      // opgeblazen caches zitten tot er toevallig een asset wijzigt (#730).
      const hash = createHash("sha256")
        .update(readFileSync(r("./dist/.vite/manifest.json")))
        .update(source)
        .digest("hex")
        .slice(0, 12);
      writeFileSync(r("./dist/sw.js"), source.replace(/__SW_VERSION__/g, hash));
    },
  };
}

// Dev-tegenhanger van de club-slug-route in de Cloudflare Worker
// (worker/index.js): volgt de 308 van playtomic.io/clubs/{uuid} en geeft de
// canonieke slug terug. Als middleware geregistreerd vóór Vite's eigen proxy,
// zodat /api/playtomic/club-slug/* niet naar playtomic.com wordt doorgestuurd.
function playtomicClubSlug(): Plugin {
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return {
    name: "playtomic-club-slug",
    configureServer(server) {
      server.middlewares.use("/api/playtomic/club-slug", async (req, res) => {
        const json = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify(body));
        };
        const uuid = (req.url ?? "").replace(/^\//, "").split(/[?#]/)[0].toLowerCase();
        if (!UUID_RE.test(uuid)) return json(404, { error: "bad uuid" });
        try {
          const upstream = await fetch(`https://playtomic.io/clubs/${uuid}`, {
            redirect: "manual",
          });
          const location = upstream.headers.get("location") ?? "";
          const slug = /\/clubs\/([^/?#]+)/.exec(location)?.[1];
          if (!slug || slug === uuid) return json(404, { error: "no slug" });
          return json(200, { slug });
        } catch {
          return json(404, { error: "unreachable" });
        }
      });
    },
  };
}

// Dev-tegenhanger van de club-search-route in de Worker (worker/index.js) en de
// edge function club-search: leest de Playtomic-zoekpagina en geeft de geparste
// trefferlijst terug. In productie kán dit niet rechtstreeks (de WAF weert
// datacenter-IP's, #385/#392), maar een dev-machine zit op een residentieel IP
// — daarom hier geen egress-hop en geen gedeeld geheim. De parser is wél
// dezelfde, zodat dev en productie niet uit elkaar lopen.
function playtomicClubZoeken(): Plugin {
  return {
    name: "playtomic-club-search",
    configureServer(server) {
      server.middlewares.use("/api/playtomic/club-search", async (req, res) => {
        const json = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify(body));
        };
        const vraag = (
          new URL(req.url ?? "", "http://dev.local").searchParams.get("q") ?? ""
        ).trim();
        if (
          vraag.length < ZOEK_MIN_LENGTE ||
          vraag.length > ZOEK_MAX_LENGTE
        ) {
          return json(400, { error: "bad query" });
        }
        try {
          const upstream = await fetch(zoekUrl(vraag), { headers: ZOEK_HEADERS });
          if (!upstream.ok) return json(upstream.status, { error: "upstream" });
          return json(200, {
            clubs: belgischeClubs(parseClubs(await upstream.text())),
          });
        } catch {
          return json(502, { error: "upstream unreachable" });
        }
      });
    },
  };
}

// https://vite.dev + https://vitest.dev
export default defineConfig({
  plugins: [
    playtomicClubSlug(),
    playtomicClubZoeken(),
    react(),
    serviceWorkerVersion(),
  ],
  // Build-aanduiding voor de foutrapportage (#733): zonder dit weet je bij een
  // melding niet wélke versie crashte. In CI is GITHUB_SHA gezet, lokaal niet.
  define: {
    __BUILD__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? "dev"),
  },
  // Path-aliases — houd in sync met tsconfig.app.json "paths" (zie docs/architecture.md §5).
  // Langste sleutels eerst zodat "@/lib" vóór "@/" matcht.
  resolve: {
    alias: [
      { find: /^@\/lib\//, replacement: r("./src/lib/") },
      { find: /^@\/ui\//, replacement: r("./src/components/ui/") },
      { find: /^@\/features\//, replacement: r("./src/features/") },
      { find: /^@\/types$/, replacement: r("./src/types/index.ts") },
      { find: /^@\/types\//, replacement: r("./src/types/") },
      { find: /^@\//, replacement: r("./src/") },
    ],
  },
  server: {
    proxy: {
      // Proxy naar Playtomic zodat de browser geen CORS-blokkade krijgt.
      // In productie doet de Cloudflare Worker (worker/index.js) hetzelfde.
      // (De /club-slug/-route wordt hierboven al door de middleware afgevangen.)
      "/api/playtomic": {
        target: "https://playtomic.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/playtomic/, ""),
      },
    },
  },
  build: {
    // Manifest met álle chunks (ook lazy routes): de service worker pre-cachet
    // hiermee de volledige app-shell voor offline gebruik.
    manifest: true,
    rollupOptions: {
      output: {
        // Splits grote, stabiele afhankelijkheden af van app-code, zodat
        // deze chunks gecached blijven bij latere app-updates.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("react") || id.includes("scheduler")) return "react";
          }
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "worker/**/*.{test,spec}.js",
      "scripts/**/*.{test,spec}.mjs",
      // Deno edge-function-helpers met pure logica (bv. cronAuth, #460).
      "supabase/functions/**/*.{test,spec}.ts",
    ],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        // Bootstrap en gegenereerde databanktypes: geen testbare logica.
        "src/app/main.tsx",
        "src/lib/supabase/database.types.ts",
        "src/test/**",
      ],
      // Ondergrens: `npm run coverage` faalt als de dekking hieronder zakt.
      thresholds: {
        statements: 70,
        lines: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
});