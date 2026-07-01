import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom geeft je een browser-achtige DOM in tests (document, window, ...)
    environment: "jsdom",
    // describe/it/expect zonder imports
    globals: true,
    include: ["tests/**/*.{test,spec}.js"],
    coverage: {
      reporter: ["text", "html"],
      include: ["js/**/*.js"],
    },
  },
});