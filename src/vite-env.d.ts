/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Korte build-aanduiding (git-sha in CI, "dev" lokaal), ingevuld door de
 *  `define` in vite.config.ts. Zonder dit weet je bij een foutmelding niet
 *  wélke versie crashte. */
declare const __BUILD__: string;