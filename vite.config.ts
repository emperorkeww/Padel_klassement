/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev + https://vitest.dev
export default defineConfig({
  plugins: [react()],
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
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/main.tsx", "src/test/**"],
    },
  },
});