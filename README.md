# Padel Klassement

Een sociale padel-app om met je vaste groep te spelen, matches te loggen en een
klassement bij te houden. Wedstrijden zijn dubbel (teams van twee), de score
wordt punt-voor-punt vastgelegd en zowel het punten-klassement als de Elo-rating
worden live uit de afgeronde matches berekend. Coach Rudy — de vaste commentator
— roast en hypet er dwars doorheen.

React 19 + TypeScript + Supabase, gebouwd met Vite en gedeployed als Cloudflare
Worker. Getest met Vitest + Testing Library (frontend) en pgTAP (database).

## Features

- **Groepen** — speel samen in een groep met eigen klassement; leden toevoegen
  via een deelbare invite-link. Teams indelen kan handmatig of automatisch:
  **Americano**, **Mexicano** en **eerlijke teams** (op basis van rating).
- **Matches** — plan een match of log een uitslag; punt-voor-punt score,
  matchdetail met verloop, gastspelers voor wie (nog) geen account heeft.
- **Klassement & tiers** — punten-klassement (globaal én per groep) plus
  **divisies/tiers** afgeleid van de rating, met een roze roast-kroon voor de
  nummer 1 ("Big Daddy").
- **Elo-rating** — rating met historie (`rating_history`) en een grafiek op het
  profiel; incrementeel bijgewerkt per match.
- **Vrienden** — verzoeken sturen, vriendsuggesties op basis van gemeenschappe-
  lijke vrienden, privacy-instellingen.
- **Baanbeschikbaarheid** — live vrije banen en prijzen via Playtomic (proxy in
  de Worker), met deelbare posters voor de groepschat.
- **Speeldag-polls** — prik samen een moment; polls worden zelfsturend afgerond
  via een edge function.
- **Feed** — activiteitenfeed met highlight-kaarten en commentaar van Coach Rudy.
- **Toto** — voorspel uitslagen; apart voorspellings-klassement per groep.
- **Roast & anti-eer** — Pias van de week/maand en de rondgaande "Zwarte Piet"
  schande-token, met een instelbare roast-intensiteit en roast-schild per groep.
- **Notificaties & PWA** — web-push (nieuwe ronde, uitslag, match-reminders,
  poll-deadlines) en installeerbaar als PWA.

## Structuur

```
index.html                 Vite entry
wrangler.jsonc             Cloudflare Worker-config (assets + Playtomic-proxy)
worker/
  index.js                 Worker: serveert de build én proxyt /api/playtomic/*
src/
  app/
    main.tsx               React entry (BrowserRouter + AuthProvider)
    App.tsx                 routes (publiek /login, beschermde app-routes)
    index.css               globale stijl + design-tokens
  features/                 één map per domein (code + tests naast elkaar)
    auth/                   AuthProvider, LoginScreen, ResetPassword, ProtectedRoute
    dashboard/              startpagina achter login
    feed/                   activiteitenfeed
    standings/              klassement (Leaderboard) + tiers
    matches/                matches-lijst, wizard, MatchDetail
    groups/                 groepen, GroupDetail, JoinGroup, teamindeling
    friends/                vrienden & suggesties
    profiles/              publiek spelersprofiel
    account/                eigen profiel + instellingen
    availability/           baanbeschikbaarheid (Playtomic)
    wrapped/                seizoens-/jaaroverzicht
  components/               herbruikbare UI (Sheet, TierBadge, Coach, charts, …)
  lib/                      supabase-client, elo, roast, helpers, types
  test/setup.ts            jest-dom matchers voor Vitest
supabase/
  config.toml              CLI-config (schema_paths, seed, functions)
  schemas/                 declaratieve schema-definities (bron van waarheid)
    tables/                01_profiles … 16_zwarte_piet (numerieke FK-volgorde)
    views/                 standings, player_standings, group_*_standings
    functions/             SQL-functies & triggers (Americano, ratings, …)
    policies/              RLS-policies per tabel
  functions/               Deno edge functions (send-push, reminders, polls)
  migrations/              gegenereerde migrations (via `supabase db diff`)
  snippets/                pg_cron- & webhook-SQL voor de edge functions
  tests/                   pgTAP database-tests
  seed.sql                 rijke lokale testdata (via `supabase db reset`)
scripts/contrast-check.mjs  toegankelijkheids-check op de kleurtokens
docs/                      aanvullende documentatie
```

## Datamodel

Kern:

| Object            | Rol                                                            |
| ----------------- | ------------------------------------------------------------- |
| `profiles`        | Speler, 1-op-1 met `auth.users` (auto-aangemaakt bij signup)  |
| `teams`           | Vast paar van twee spelers (uniek ongeacht volgorde)          |
| `matches`         | Wedstrijd tussen twee teams, met status en winnaar            |
| `match_points`    | Score per punt — bron van waarheid voor de score              |

Groepen & sociaal:

| Object            | Rol                                                            |
| ----------------- | ------------------------------------------------------------- |
| `groups`          | Speelgroep met eigen klassement en instellingen               |
| `group_members`   | Lidmaatschap (rol: eigenaar/lid)                              |
| `group_invites`   | Deelbare invite-tokens om lid te worden                       |
| `friendships`     | Vriendschappen + openstaande verzoeken                        |

Rating:

| Object            | Rol                                                            |
| ----------------- | ------------------------------------------------------------- |
| `player_ratings`  | Actuele Elo-rating per speler (basis 1000)                    |
| `rating_history`  | Rating-verloop per match, voor de grafiek                     |

Plannen & aanwezigheid:

| Object                                   | Rol                                          |
| ---------------------------------------- | -------------------------------------------- |
| `attendance`                             | Wie is er (van plan) op een speeldag         |
| `slot_availability`                      | Bewaarde baan-beschikbaarheid (Playtomic)    |
| `play_polls` / `_options` / `_votes`     | Speeldag-poll: momenten voorstellen & stemmen|
| `match_reminders`                        | Verzonden herinneringen (idempotentie)       |

Notificaties & spel-extra's:

| Object                | Rol                                                        |
| --------------------- | ---------------------------------------------------------- |
| `push_subscriptions`  | Web-push-subscriptions per apparaat                        |
| `match_predictions`   | Toto-voorspellingen op matches                             |
| `pias_of_week`        | "Pias" (sukkel) van de week per groep                      |
| `zwarte_piet`         | Rondgaand schande-token per groep                          |

Views (afgeleid, live berekend): `standings` (globaal klassement),
`player_standings`, `group_player_standings` en `group_prediction_standings`
(toto-klassement per groep).

Alle tabellen hebben Row Level Security aan: doorgaans publiek leesbaar, schrijven
enkel door de betrokken speler(s), groepsleden of de aanmaker.

## Aan de slag (frontend)

```bash
npm install
cp .env.example .env     # vul je Supabase URL + anon key in (zie .env.example)
npm run dev              # dev server op http://localhost:5173
```

### Scripts

| Commando             | Doet                                       |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | Vite dev server                            |
| `npm run build`      | Type-check (`tsc -b`) + productie-build    |
| `npm run preview`    | Preview van de build                       |
| `npm test`           | Tests één keer draaien (Vitest)            |
| `npm run test:watch` | Tests in watch-mode                        |
| `npm run coverage`   | Tests + coverage-rapport                   |
| `npm run lint`       | ESLint                                     |
| `npm run contrast`   | Contrast-check op de design-kleurtokens    |

## Supabase (lokaal)

De lokale stack draait in Docker; Docker Desktop moet gestart zijn.

```bash
supabase start          # lokale DB, API en Studio (Docker)
supabase db reset       # past migrations toe + laadt seed.sql
supabase test db        # draait de pgTAP-tests
supabase status         # toont poorten en keys
```

Studio: <http://127.0.0.1:54323> · DB: poort `54322` · API: poort `54321`.
De seed bevat een rijke testset. Testgebruikers (bv. `alice@example.com`,
`bob@example.com`, …) hebben wachtwoord `password123`.

### Schema wijzigen (declaratief)

Het schema is **declaratief**: pas de `.sql`-bestanden in `supabase/schemas/`
aan (níét klikken in Studio — dat overschrijf je bij de volgende reset) en
genereer daaruit een migration:

```bash
# 1) wijzig supabase/schemas/...
supabase db diff -f <naam_van_wijziging>   # genereert een migration
supabase db reset                          # past alles opnieuw toe
```

`config.toml` bepaalt de laadvolgorde via `schema_paths`
(`tables/` → `views/` → `functions/` → `policies/`). De numerieke prefixes in
`tables/` borgen dat tabellen met foreign keys in de juiste volgorde laden.

> ⚠️ `supabase db diff` mist soms kolom-grants en `security_invoker` op views.
> Loop de gegenereerde migration altijd na voordat je 'm commit.

Naar de gehoste database pushen gaat via de migrations. Dit gebeurt **niet**
vanzelf bij een release — doe het expliciet:

```bash
supabase link --project-ref <project-ref>
supabase db push --linked
```

### Edge functions

De Deno-functies in `supabase/functions/` doen het werk dat buiten de client om
moet gebeuren:

| Function          | Rol                                                              |
| ----------------- | --------------------------------------------------------------- |
| `send-push`       | Verstuurt web-push op database-webhooks (nieuwe ronde/uitslag)  |
| `match-reminders` | Push X uur vóór een geplande match (via `pg_cron`)              |
| `poll-deadline`   | Maakt speeldag-polls zelfsturend: laatste-kans-push & afronden  |
| `remind-group`    | Client-aanroep: por groepsleden die nog niet gestemd hebben     |

De cron- en webhook-koppelingen staan als SQL in `supabase/snippets/`. De
`send-push`/`match-reminders`-functies hebben een privé-**VAPID**-sleutel nodig
in de Supabase-secrets (zie `supabase/functions/send-push/README.md`).

```bash
supabase functions serve <naam>                    # lokaal draaien
supabase functions deploy <naam> --project-ref <ref>   # deployen
```

## Productie-deploy (Cloudflare Worker)

De app wordt als **Cloudflare Worker** gedeployed: dezelfde Worker serveert de
static build én proxyt `/api/playtomic/*` naar Playtomic (de browser mag
Playtomic niet rechtstreeks aanroepen — geen CORS). Config staat in
`wrangler.jsonc` (SPA-fallback, per-IP rate-limiting op de proxy).

De deploy is geautomatiseerd via GitHub Actions (`.github/workflows/deploy.yml`):
elke push naar **`main`** bouwt met de productie-Supabase-waarden en deployt de
Worker. Benodigde GitHub-secrets:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`
- `CLOUDFLARE_API_TOKEN` (Workers-edit-rechten), `CLOUDFLARE_ACCOUNT_ID`

Handmatig deployen kan met:

```bash
npm run build
npx wrangler deploy
```

## CI

`.github/workflows/ci.yml` draait op elke PR: lint, build (type-check + bundle),
Vitest en de pgTAP-databasetests.

## Branches

- **`main`** — clean baseline, alleen bijgewerkt bij een release; dit is de
  default branch en de bron voor de productie-deploy.
- **`develop`** — actieve ontwikkeling; hier komt al het werk binnen.

> Feature-PR's mergen naar `develop`. GitHub sluit een issue alleen automatisch
> bij een merge naar de default branch (`main`), dus zet `Closes #…` in de
> **release-PR** (`develop → main`) en `Refs #…` in feature-PR's. Zie
> `.github/PULL_REQUEST_TEMPLATE.md`.
