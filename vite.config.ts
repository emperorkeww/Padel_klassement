/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// https://vite.dev + https://vitest.dev
export default defineConfig({
  plugins: [react()],
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
      "/api/playtomic": {
        target: "https://api.playtomic.io",
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
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
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