# Webproject

React + TypeScript + Supabase, gebouwd met Vite. Getest met Vitest + Testing Library.

## Structuur

```
index.html              Vite entry
src/
  main.tsx              React entry point
  App.tsx               root component
  index.css / App.css   stijlen
  lib/
    supabase.ts         Supabase client (leest .env)
    utils.ts            voorbeeld helpers
  test/setup.ts         jest-dom matchers voor Vitest
  *.test.ts(x)          tests staan naast de code
public/                 statische bestanden (as-is geserveerd)
src/assets/             geïmporteerde assets (via bundler)
supabase/               database (migrations, config via `supabase init`)
docs/                   documentatie
```

## Aan de slag

```bash
npm install
cp .env.example .env    # vul je Supabase URL + anon key in
npm run dev             # dev server
```

## Scripts

| Commando            | Doet                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | Vite dev server               |
| `npm run build`     | Type-check + productie-build  |
| `npm run preview`   | Preview van de build          |
| `npm test`          | Tests één keer draaien        |
| `npm run test:watch`| Tests in watch-mode           |
| `npm run coverage`  | Tests + coverage-rapport      |

## Supabase

```bash
supabase init           # genereert config.toml + structuur
```

Vul daarna `.env` met je project-URL en anon key (Project Settings → API).
De frontend praat via `@supabase/supabase-js` (bovenop de auto-gegenereerde REST API).