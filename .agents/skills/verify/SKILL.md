---
name: verify
description: End-to-end verifiëren van wijzigingen in deze padel-app — dev-server starten, inloggen met seed-gebruikers en de UI aansturen met Playwright.
---

# Verify: padel-app end-to-end draaien

## Opzet

- Vite-app met Supabase-backend. `.env` wijst naar de **lokale** Supabase
  (`http://localhost:54321`); die draait via Docker (`supabase start`,
  container `supabase_db_Padel`). Check eerst: `curl -s -o /dev/null -w "%{http_code}" http://localhost:54321/rest/v1/` → 200.
- `.env` is niet gecommit: in een git-worktree eerst kopiëren vanuit de
  hoofdcheckout, anders faalt o.a. `src/lib/supabase.ts` ("supabaseUrl is required").
- Dev-server: `npm run dev -- --port <vrije poort>` (5173 kan bezet zijn door
  een andere sessie).

## Inloggen (seed-gebruikers)

`supabase/seed.sql` maakt vier accounts aan, wachtwoord `password123`:
alice@example.com (Alice Anders), bob@, carol@, dave@example.com.
Login op `/login`: velden via label "E-mail(adres)" en "Wachtwoord",
knop "Log in"; na succes redirect naar `/`.

## Aansturen met Playwright

Playwright + Chromium staan in de npx-cache (`npx --no-install playwright --version`),
niet in package.json. In een los script: symlink de npx-cache-node_modules naast
je script (`ln -sfn ~/.npm/_npx/<hash>/node_modules <scriptdir>/node_modules`),
ESM negeert NODE_PATH.

- Routes: `/klassement` (Leaderboard), `/spelers/:id` (profiel + RatingChart),
  `/matches`, `/spelen` (groepen).
- Mobiele weergave: viewport ≤ 640px breed → tabel verdwijnt, `.ranklist` verschijnt.
- De seed bevat maar één afgeronde match; de RatingChart op het profiel vereist
  ≥ 2 punten historie. Voeg tijdelijk een match toe (ratings herberekenen via
  trigger) en verwijder hem na afloop weer:
  `docker exec supabase_db_Padel psql -U postgres -d postgres -c "insert into public.matches (id, team_a_id, team_b_id, status, winner_team_id, played_at, created_by) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','completed','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now(), '11111111-1111-1111-1111-111111111111');"`
  (opruimen: `delete from public.matches where id='eeeeeeee-…';`)
- `psql` staat niet op het systeem; ga altijd via `docker exec supabase_db_Padel psql -U postgres`.

## Valkuilen

- `waitForSelector` op datalijsten kan transient timeouten vlak na een verse
  serverstart; opnieuw proberen helpt.
- Reduced motion testen: Playwright-context met `reducedMotion: "reduce"`.
