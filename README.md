# Padel Klassement

Beheer padel-wedstrijden en houd een klassement bij. Wedstrijden worden
gespeeld tussen teams van twee spelers (dubbel), de score wordt punt-voor-punt
bijgehouden en het klassement wordt live berekend uit de afgeronde matches.

React + TypeScript + Supabase, gebouwd met Vite. Getest met Vitest + Testing
Library (frontend) en pgTAP (database).

## Structuur

```
index.html                Vite entry
src/
  main.tsx                React entry (BrowserRouter + AuthProvider)
  App.tsx                 routes: publiek /login, beschermde /
  features/auth/
    AuthProvider.tsx      sessie-context rond de Supabase-auth
    LoginScreen.tsx       inloggen / registreren
    ProtectedRoute.tsx    schermt routes af zonder sessie
  pages/
    Dashboard.tsx         startpagina achter login
  lib/
    supabase.ts           Supabase client (leest .env)
    utils.ts              helpers
  test/setup.ts           jest-dom matchers voor Vitest
  *.test.ts(x)            tests staan naast de code
supabase/
  config.toml             CLI-config (o.a. schema_paths, seed)
  schemas/                declaratieve schema-definities (bron van waarheid)
    tables/               01_profiles, 02_teams, 03_matches, 04_match_points
    views/                standings (klassement)
    policies/             RLS-policies per tabel
  migrations/             gegenereerde migrations (via `supabase db diff`)
  tests/                  pgTAP database-tests
  seed.sql                lokale testdata (via `supabase db reset`)
docs/                     documentatie
```

## Datamodel

| Object          | Rol                                                            |
| --------------- | ------------------------------------------------------------- |
| `profiles`      | Speler, 1-op-1 met `auth.users` (auto-aangemaakt bij signup)  |
| `teams`         | Vast paar van twee spelers (uniek ongeacht volgorde)          |
| `matches`       | Wedstrijd tussen twee teams, met status en winnaar            |
| `match_points`  | Score per punt — bron van waarheid voor de score              |
| `standings`     | View die het klassement live berekent (winst = 3 punten)      |

Alle tabellen hebben Row Level Security aan: publiek leesbaar, schrijven enkel
door de betrokken speler(s) of de aanmaker.

## Aan de slag (frontend)

```bash
npm install
cp .env.example .env    # vul je Supabase URL + anon key in
npm run dev             # dev server
```

## Scripts

| Commando             | Doet                          |
| -------------------- | ----------------------------- |
| `npm run dev`        | Vite dev server               |
| `npm run build`      | Type-check + productie-build  |
| `npm run preview`    | Preview van de build          |
| `npm test`           | Tests één keer draaien        |
| `npm run test:watch` | Tests in watch-mode           |
| `npm run coverage`   | Tests + coverage-rapport      |

## Supabase (lokaal)

De lokale stack draait in Docker; Docker Desktop moet gestart zijn.

```bash
supabase start          # lokale DB, API en Studio (Docker)
supabase db reset       # past migrations toe + laadt seed.sql
supabase test db        # draait de pgTAP-tests
supabase status         # toont poorten en keys
```

Studio: <http://127.0.0.1:54323> · DB: poort `54322` · API: poort `54321`.
Testgebruikers uit de seed (bv. `alice@example.com`) hebben wachtwoord
`password123`.

### Schema wijzigen

Het schema is **declaratief**: pas de `.sql`-bestanden in `supabase/schemas/`
aan (níét klikken in Studio — dat overschrijf je bij de volgende reset) en
genereer daaruit een migration:

```bash
# 1) wijzig supabase/schemas/...
supabase db diff -f <naam_van_wijziging>   # genereert een migration
supabase db reset                          # past alles opnieuw toe
```

`config.toml` bepaalt de laadvolgorde via `schema_paths`
(`tables/` → `views/` → `policies/`). De numerieke prefixes in `tables/`
borgen dat tabellen met foreign keys in de juiste volgorde laden.

Naar de cloud pushen gaat via de migrations:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

## Branches

- **`main`** — clean baseline, alleen bijgewerkt bij een release.
- **`develop`** — actieve ontwikkeling; hier komt al het werk binnen.