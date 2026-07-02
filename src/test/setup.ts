// Voegt jest-dom matchers toe (toBeInTheDocument, toHaveTextContent, ...).
// Geladen via `setupFiles` in vite.config.ts.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { invalidateAll } from "../lib/queryCache";

// De querycache is module-level; tussen tests legen zodat elke test zijn
// eigen (mock)data ziet in plaats van een hit uit de vorige test.
afterEach(() => invalidateAll());
