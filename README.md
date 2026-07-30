# 🎾 Padel Klassement

Padel Klassement is een sociale webapplicatie ontworpen voor vriendengroepen om hun onderlinge padelcompetities te organiseren, wedstrijden te loggen en dynamische klassementen bij te houden. 

De applicatie legt dubbelspelwedstrijden (teams van twee) punt-voor-punt vast en berekent live zowel een algemeen puntenklassement als een dynamische Elo-rating. Om de competitie extra scherp te houden, voorziet de ingebouwde virtuele commentator **Coach Rudy** de resultaten en activiteitenfeed live van motiverend commentaar en de nodige roasts.

De stack bestaat uit **React 19 + TypeScript + Supabase**, gebouwd met **Vite** en gedeployed als een **Cloudflare Worker** met static assets en een ingebouwde API-proxy.

---

## 🛠️ Technology Stack

*   **Frontend:** React 19, TypeScript, Vite, Progressive Web App (PWA) ondersteuning.
*   **Backend & Database:** Supabase (PostgreSQL) met Row Level Security (RLS), custom SQL-functies, database triggers en views.
*   **Serverless & Edge:** Cloudflare Workers (routing & Playtomic API proxy), Deno (Supabase Edge Functions).
*   **Testing:** Vitest & React Testing Library (frontend), pgTAP (database-integratietests).
*   **CI/CD:** GitHub Actions voor automatische tests, codekwaliteit en deployment.

---

## 🌟 Features

*   👥 **Groepen & Spelen (Groepspagina)**
    *   Maak groepen aan met een eigen klassement en voeg leden toe via een invite-link.
    *   De groepspagina volgt de reis van een speeldag: **Plannen** (speelpolls en baankeuze), **Vandaag** (de rondes van vandaag met de uitslagen), **Teams** (de teamgenerator en losse partijen), **Historie** (alle gespeelde wedstrijden), **Stand** en **Leden**.
    *   Genereer automatisch teams op basis van speelsterkte (**eerlijke teams** op basis van Elo) of organiseer specifieke toernooivormen zoals **Americano** en **Mexicano**.
    *   Ondersteuning voor gastspelers zonder geregistreerd account.
*   📊 **Wedstrijden & Statistieken**
    *   Plan toekomstige wedstrijden of log direct uitslagen (termen zijn gestroomlijnd van 'Wedstrijdrondes' naar **Wedstrijden**).
    *   Punt-voor-punt invoer en gedetailleerde weergave van het scoreverloop per wedstrijd.
    *   Historische Elo-ratinggrafieken op spelersprofielen.
*   🏆 **Klassementen & Tiers**
    *   Ranglijsten op zowel globaal niveau als per specifieke groep.
    *   Indeling in divisies/tiers op basis van Elo-rating (van *Sletje van de baan* tot de absolute toprank *El Padelissimo*).
    *   De nummer 1 van het klassement krijgt de felbegeerde roze kroon en de titel *"Big Daddy"*.
    *   **De Troon (Dictatorschap):** Als een speler de grens van 1600 rating passeert, bestijgt hij **De Troon** als dictator (*El Padelissimo*) en wordt hij afgezonderd van het reguliere klassement. Bij gebrek aan een gekwalificeerde speler wordt de troon bij verstek bezet door Kylian Mbappé als *Madrid-Dictator* (inclusief eigen dictator-volkslied).
*   🎾 **Playtomic Integratie & Boekingen**
    *   Live ophalen van vrije banen en tarieven via Playtomic (geproxied via de Cloudflare Worker).
    *   Genereer direct deelbare visuele posters van beschikbare banen voor in groepschats (WhatsApp/Signal).
*   🗳️ **Speeldag-Polls**
    *   Organiseer polls om speelmomenten te prikken met de groep.
    *   Zelfsturende afhandeling (inclusief notificaties en automatische sluiting) via een cron-gestuurde edge function.
*   🔥 **Gamification & Social Feed**
    *   Activiteitenfeed met dynamische highlight-kaarten en live commentaar van Coach Rudy.
    *   **Toto:** Voorspel de uitslagen van geplande wedstrijden en strijd mee in het toto-klassement van je groep.
    *   **Roast & Anti-Eer:** Wekelijkse/maandelijkse *"Pias van de week"* verkiezingen en de rondgaande *"Zwarte Piet"* schande-token. De roast-intensiteit en het roast-schild zijn per groep configureerbaar.
    *   **De Schandpaal:** de tegenhanger van De Troon, onderaan het klassement — de pias van de club groot in beeld met de reden van zijn afgang en een sneer van Coach Rudy. Wie een roast-schild aan heeft, verschijnt er niet.
    *   **AI-portretten:** wie de troon of de schandpaal haalt, krijgt van zijn profielfoto een gegenereerd portret (generalissimo respectievelijk hofnar, via OpenAI `gpt-image-1`). Per soort uit te zetten in Instellingen → Weergave; uitgezet betekent dat de foto nooit verstuurd wordt.
*   🔔 **Notificaties & PWA**
    *   Web-Push notificaties voor nieuwe speelrondes, uitslagen, wedstrijdherinneringen en poll-deadlines.
    *   Installeerbaar als Progressive Web App (PWA) op mobiel en desktop.

---

## 🏆 Tiers & Divisies

De applicatie verdeelt spelers op basis van hun actieve Elo-rating onder in verschillende divisies. Deze indeling bepaalt de badges, toasts, en visuals in de app:

| Divisie | Rating | Sleutel | Emoji | Karakteristiek / Flavor |
| :--- | :--- | :--- | :--- | :--- |
| **El Padelissimo** | 1600+ | `dictator` | 🫡 | Regeert de club als absolute dictator, weert tegenstanders per direct uit de groepsapp en eist 90% van de baromzet. |
| **GOAT** | 1400–1599 | `legende` | 🐐 | Heeft een ego dat zo reusachtig groot is dat het niet eens in de kooi past. |
| **Forever second** | 1300–1400 | `meester` | 🥈 | Eeuwig gedoemd om de verliezersfinale te spelen, de ultieme figurant. |
| **Eeuwige belofte** | 1200–1300 | `diamant` | ⏳ | Staat in theorie altijd 5-1 voor in de beslissende set, maar choket gegarandeerd zodra er druk op de ketel staat. |
| **Glazenwasser** | 1100–1200 | `platina` | 🪟 | Heeft de glazen achterwand zo vaak geraakt dat hij er inmiddels woont. |
| **Wannabe** | 1000–1100 | `goud` | 😤 | Koopt een racket van €350 om het chronische gebrek aan talent te compenseren. *(Startniveau)* |
| **Blaaskaak** | 900–1000 | `zilver` | 💨 | Geeft luidkeels tactisch advies dat-ie zelf nog nooit succesvol heeft uitgevoerd. |
| **Bankvuller** | 800–900 | `brons` | 🪑 | Blijft bij voorkeur op de bank zitten om het spelniveau niet te verpesten. |
| **Ballenraper** | 700–800 | `hout` | 🎾 | Besteedt 90% van de tijd aan het bukken en rapen van ballen; slaat ze zelden over het net. |
| **Stofzuiger** | 600–700 | `karton` | 🧹 | Rent blindelings op elke bal af, inclusief de ballen die overduidelijk voor zijn partner bedoeld waren. |
| **Sletje van de baan** | 500–600 | `slof` | 🥴 | Wordt door de rest van de club gebruikt voor makkelijke gratis winst. |

---

## 📂 Projectstructuur

Het project hanteert een modulaire opzet waarbij frontend-domeinen en backend-schema's strikt gescheiden zijn:

```
index.html                  # Vite entry point
wrangler.jsonc              # Cloudflare Worker configuratie (assets + Playtomic-proxy)
worker/
  index.js                  # Worker-script: serveert static assets & proxyt /api/playtomic/*
src/
  app/
    main.tsx                # React entry (routing & providers)
    App.tsx                 # Routing (publieke en beschermde routes)
    index.css               # Globale styles & CSS-variabelen (design system tokens)
  components/
    ui/                     # Generieke, herbruikbare UI-componenten (Sheet, Skeleton, Toast, Avatar, enz.)
  features/                 # Domeingestuurde mappen (code, componenten & tests bij elkaar)
    account/                # Instellingen & profielbeheer
    auth/                   # AuthProvider, login, wachtwoord herstellen & routebeveiliging
    availability/           # Playtomic baanbeschikbaarheid & posters
    coach/                  # Coach Rudy's roast-algoritmes en visualisaties (Bubble, Sneer, Avatar)
    dashboard/              # Startpagina na inloggen
    dictator/               # Dictator-troon assets: portretten, volksliederen en imperium-illustraties
    feed/                   # Activiteitenfeed & Coach Rudy integratie
    friends/                # Vriendenbeheer, verzoeken & vriendsuggesties
    groups/                 # Groepsbeheer, Americano/Mexicano & groepspagina (Plannen · Vandaag · Teams · Historie · Stand · Leden)
    matches/                # Wedstrijdregistratie (wizard, score-steppers, toto, excuses)
    profiles/               # Publieke spelersprofielen & statistieken
    rating/                 # Elo-berekeningen, tiers/divisies & ratinggrafieken (RatingChart, RankChart)
    standings/              # Klassementen (Leaderboards)
    wrapped/                # Periodieke seizoens- en seizoensoverzichten
  lib/                      # Gedeelde technische functionaliteit
    hooks/                  # Generieke React hooks (useAsync, useRealtime, useFlip, etc.)
    supabase/               # Supabase client, query caching, push-notificaties & database types
    utils/                  # Generieke helpers (formatting, haptics, sharing, theme, time)
  types/
    index.ts                # Handgeschreven TypeScript type-definities voor core DB-entiteiten
  test/setup.ts             # Jest-dom matchers configuratie voor Vitest
supabase/
  config.toml               # Supabase CLI configuratie (laadvolgorde, functies, seed)
  schemas/                  # Declaratieve schema-definities (bron van waarheid)
    tables/                 # Databasetabellen (genummerd op basis van FK-afhankelijkheden)
    views/                  # Database views voor live klassementen en statistieken
    functions/              # SQL functies & database triggers (o.a. Elo en toernooivormen)
    policies/               # Row Level Security (RLS) policies per tabel
  functions/                # Deno edge functions (pushberichten, reminders, polls)
  migrations/               # Database migraties gegenereerd via de Supabase CLI
  snippets/                 # SQL-snippets voor pg_cron & database webhooks
  tests/                    # pgTAP database-integratietests
  seed.sql                  # Rijke testdata voor lokale ontwikkeling
scripts/
  contrast-check.mjs        # Toegankelijkheidstest op de design system kleurentokens
  optimize-assets.mjs       # Comprimeert illustraties (WebP) en audio vóór ze de repo in gaan
```

---

## 💾 Datamodel

### Kernconcepten

| Tabel | Omschrijving |
| :--- | :--- |
| [`profiles`](supabase/schemas/tables/01_profiles.sql) | Gebruikersprofiel, 1-op-1 gekoppeld aan `auth.users` via een trigger. |
| [`teams`](supabase/schemas/tables/02_teams.sql) | Uniek paar van twee spelers (onafhankelijk van speler-volgorde). |
| [`matches`](supabase/schemas/tables/05_matches.sql) | Wedstrijd tussen twee teams inclusief status en uiteindelijke winnaar. |
| [`match_points`](supabase/schemas/tables/06_match_points.sql) | Punt-voor-punt scoreverloop van een wedstrijd (bron van waarheid voor de stand). |

### Groepen & Sociaal

| Tabel | Omschrijving |
| :--- | :--- |
| [`groups`](supabase/schemas/tables/03_groups.sql) | Speelgroep met eigen instellingen (bijv. roast-intensiteit). |
| [`group_members`](supabase/schemas/tables/04_group_members.sql) | Lidmaatschappen van een groep (rollen: eigenaar of lid). |
| [`group_invites`](supabase/schemas/tables/11_group_invites.sql) | Uitnodigingstokens om lid te worden van een groep. |
| [`friendships`](supabase/schemas/tables/07_friendships.sql) | Vriendschappen en openstaande vriendschapsverzoeken. |

### Elo & Ratings

| Tabel | Omschrijving |
| :--- | :--- |
| [`player_ratings`](supabase/schemas/tables/08_ratings.sql) | Actuele Elo-rating per speler (startwaarde: 1000). |
| `dictator_termijnen` | Historie en actieve ambtstermijnen van dictators (El Padelissimo) ten behoeve van machtsbehoud. |

### Plannen & Aanwezigheid

| Tabel | Omschrijving |
| :--- | :--- |
| [`attendance`](supabase/schemas/tables/09_attendance.sql) | Aanwezigheid en beschikbaarheid van spelers voor specifieke speeldagen. |
| [`slot_availability`](supabase/schemas/tables/12_slot_availability.sql) | Gecachte baanbeschikbaarheid en tarieven vanuit Playtomic. |
| [`play_polls`](supabase/schemas/tables/13_play_polls.sql) / `_options` / `_votes` | Tabellen voor het aanmaken van, en stemmen op speeldag-polls. |
| [`match_reminders`](supabase/schemas/tables/12_match_reminders.sql) | Registratie van verzonden herinneringen ter voorkoming van dubbele pushberichten. |
| [`court_availability_snapshots`](supabase/schemas/tables/18_court_availability_snapshots.sql) | Gecachte momentopnames van baanbeschikbaarheid voor het genereren van posters. |

### Notificaties & Extra's

| Tabel | Omschrijving |
| :--- | :--- |
| [`push_subscriptions`](supabase/schemas/tables/10_push_subscriptions.sql) | Web-push abonnementen per apparaat voor pushnotificaties. |
| [`match_predictions`](supabase/schemas/tables/14_match_predictions.sql) | Toto-voorspellingen van gebruikers op geplande wedstrijden. |
| [`pias_of_week`](supabase/schemas/tables/15_pias_of_week.sql) | De gekozen *"Pias van de week"* (minst presterende speler) per groep. |
| [`zwarte_piet`](supabase/schemas/tables/16_zwarte_piet.sql) | Het actieve *"Zwarte Piet"* schande-token binnen een groep. |
| [`match_smoesjes`](supabase/schemas/tables/17_match_smoesjes.sql) | Uitvluchten en excuses ingediend door spelers na verliespartijen. |
| [`vendettas`](supabase/schemas/tables/19_vendettas.sql) | Onderlinge rivaliteit (vendetta's) tussen spelers op basis van head-to-head resultaten. |

> [!NOTE]
> **Beveiliging:** Alle tabellen zijn beveiligd met Row Level Security (RLS). Gegevens zijn doorgaans publiek leesbaar, maar schrijfacties zijn strikt beperkt tot geautoriseerde spelers, groepsleden of de eigenaar van het object.

---

## 🚀 Aan de slag (Frontend)

### Installatie

1. Installeer de dependencies:
   ```bash
   npm install
   ```

2. Configureer de omgevingsvariabelen:
   ```bash
   cp .env.example .env
   ```
   *Vul de `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` in op basis van je Supabase project.*

3. Start de lokale ontwikkelserver:
   ```bash
   npm run dev
   ```
   *De applicatie is nu bereikbaar via [http://localhost:5173](http://localhost:5173).*

### Scripts

| Commando | Doel |
| :--- | :--- |
| `npm run dev` | Start de Vite ontwikkelserver met hot-reloading. |
| `npm run build` | Voert een TypeScript type-check uit en bouwt de productiebundel in `/dist`. |
| `npm run preview` | Start een lokale server om de productiebuild te testen. |
| `npm test` | Draait de Vitest testsuite eenmalig. |
| `npm run test:watch` | Draait de Vitest testsuite in watch-modus. |
| `npm run coverage` | Draait de frontend tests en genereert een coverage-rapport. |
| `npm run lint` | Controleert de codekwaliteit met ESLint. |
| `npm run contrast` | Voert een toegankelijkheidstest uit op de design system kleurentokens. |
| `npm run gen:courts` | Regenereert `knownCourts.ts` (baannamen/-types thuisclub) vanaf de live Playtomic-clubpagina (#392). |
| `node scripts/optimize-assets.mjs <bestand…>` | Comprimeert een nieuwe illustratie (→ WebP) of audiofragment (→ mono 96 kbps) vóór het de repo in gaat (#732). Vereist ImageMagick en ffmpeg. |

---

## 🗄️ Supabase Lokaal & Databasebeheer

Voor lokale ontwikkeling draait Supabase in Docker. Zorg ervoor dat **Docker Desktop** (of een alternatieve Docker daemon) is opgestart.

### Basiscommando's

```bash
supabase start          # Start de lokale database, API en Studio dashboards
supabase db reset       # Past alle migraties opnieuw toe en vult de database met seed.sql
supabase test db        # Voert de pgTAP database-integratietests uit
supabase status         # Toont alle lokale poorten, API endpoints en service keys
```

Na het opstarten zijn de volgende interfaces lokaal bereikbaar:
*   **Supabase Studio (Dashboard):** [http://127.0.0.1:54323](http://127.0.0.1:54323)
*   **Lokale PostgreSQL DB:** Poort `54322`
*   **REST API Gateway:** Poort `54321`

*De seed-data bevat diverse testgebruikers (zoals `alice@example.com`, `bob@example.com`). Het wachtwoord voor alle testaccounts is `password123`.*

### Declaratieve Schema-wijzigingen

De database-inrichting is volledig **declaratief** gedefinieerd onder `supabase/schemas/`. Pas **nooit** handmatig instellingen aan via de Supabase Studio interface; deze wijzigingen gaan verloren bij een database-reset.

Volg deze workflow voor schema-wijzigingen:

1.  Pas de relevante SQL-bestanden aan binnen de map `supabase/schemas/...` (bijv. tabellen, views of triggers).
2.  Genereer de migratie met de Supabase CLI:
    ```bash
    supabase db diff -f <naam_van_de_wijziging>
    ```
    *Dit commando vergelijkt je lokale schemas met de huidige staat en genereert een nieuw migratiebestand in `supabase/migrations/`.*
3.  Test de migratie lokaal door de database te resetten:
    ```bash
    supabase db reset
    ```
4.  Regenereer de TypeScript-types (CI faalt als `database.types.ts` achterloopt op het schema):
    ```bash
    npm run gen:types
    ```
    *Dit script pint de CLI-versie op die van CI, zodat de output byte-gelijk is. Commit het resultaat ongewijzigd (niet formatteren).*

> [!WARNING]
> De tool `supabase db diff` herkent soms specifieke eigenschappen niet correct, zoals toegekende kolom-grants of de `security_invoker` optie op views. Controleer de gegenereerde migratiebestanden altijd zorgvuldig voor je ze commit.

### Productiedatabase Bijwerken

De release-workflow past migraties automatisch toe nadat CI op de gemergede
`main`-commit slaagt. Voor een uitzonderlijke handmatige productie-update:

```bash
supabase link --project-ref <project-ref-id>
supabase db push --linked
```

---

## ⚡ Edge Functions & Cron Jobs

Asynchrone processen en integraties buiten de client om worden afgehandeld via **Supabase Edge Functions** (geschreven in TypeScript voor Deno):

| Edge Function | Trigger / Rol |
| :--- | :--- |
| `send-push` | Database webhook. Verstuurt Web-Push notificaties bij belangrijke events (zoals het starten van een nieuwe ronde of een ingevoerde uitslag). |
| `match-reminders` | `pg_cron` schedule. Verstuurt automatisch een pushnotificatie X uur voor aanvang van een geplande wedstrijd. |
| `poll-deadline` | `pg_cron` / webhook. Beheert de speeldag-polls: stuurt herinneringen naar niet-stemmers, sluit de poll automatisch op de deadline en zet op de ochtend van de speeldag (`POLL_ROUNDS_AT`, standaard 08:00 clubtijd) de Americano-rondes klaar als er nog geen zijn (per groep uit te zetten met `auto_rondes`). |
| `remind-group` | Client-aanroep. Handmatige actie om groepsleden via een pushnotificatie te porren om te stemmen. |
| `playtomic-availability` | Aangeroepen door de Cloudflare Worker (`env.PLAYTOMIC_EGRESS`). Egress-hop voor de baanbeschikbaarheid: Playtomic's WAF blokkeert Cloudflare-IP's maar laat Supabase-egress door (#385). Deployen met `--no-verify-jwt`. |

*De definities voor database webhooks en de cron-schedules (`pg_cron`) zijn als SQL-snippets terug te vinden in `supabase/snippets/`.*

> [!IMPORTANT]
> De functies `send-push` en `match-reminders` vereisen een geldige **VAPID-sleutelset** in de Supabase secrets. Zie de specifieke documentatie in `supabase/functions/send-push/README.md` voor configuratie-instructies.

### Edge Functions Beheren

```bash
supabase functions serve <naam>                    # Draai een edge function lokaal
supabase functions deploy <naam> --project-ref <ref>  # Deploy een edge function naar productie
```

---

## ☁️ Productie Deployment (Cloudflare Worker)

De applicatie wordt gehost als een **Cloudflare Worker** middels Wrangler. De Worker heeft een tweeledige functie:
1.  Het serveren van de static React frontend assets met Single Page Application (SPA) routing fallback.
2.  Het proxyen van `/api/playtomic/*` verzoeken naar de Playtomic API (ter voorkoming van CORS-problemen in de browser).

De configuratie is vastgelegd in [`wrangler.jsonc`](wrangler.jsonc), inclusief een **rate limiter** op de Playtomic-proxy (maximaal 20 verzoeken per 10 seconden per IP-adres).

### CI/CD Pipeline

De deployment is volledig geautomatiseerd via GitHub Actions ([`deploy.yml`](.github/workflows/deploy.yml)). Na een geslaagde CI-run op een merge naar `main` worden eerst de Supabase-migraties en Edge Functions gedeployed, daarna de frontend naar Cloudflare. Pull requests ontvangen geen productie-secrets en kunnen dus niet deployen.

Daarnaast draait wekelijks [`known-courts.yml`](.github/workflows/known-courts.yml): die regenereert `knownCourts.ts` vanaf de live Playtomic-clubpagina en opent bij drift automatisch een PR naar `develop` (Refs #392). Handmatig bijwerken kan altijd met `npm run gen:courts`.

Hiervoor dienen de volgende secrets in de GitHub Repository geconfigureerd te zijn:
*   `VITE_SUPABASE_URL`
*   `VITE_SUPABASE_ANON_KEY`
*   `VITE_VAPID_PUBLIC_KEY`
*   `SUPABASE_ACCESS_TOKEN` (Supabase personal access token met deployrechten)
*   `SUPABASE_PROJECT_REF` (de productie project-ref)
*   `SUPABASE_DB_PASSWORD` (het databasewachtwoord van dat project; `supabase db push` verbindt rechtstreeks met Postgres)
*   `CLOUDFLARE_API_TOKEN` (met Workers-edit rechten)
*   `CLOUDFLARE_ACCOUNT_ID`

### Handmatige Deployment

```bash
npm run build
npx wrangler deploy
```

---

## 🧪 Continuous Integration (CI)

Bij elke Pull Request naar `develop` of `main` voert de CI pipeline ([`ci.yml`](.github/workflows/ci.yml)) automatisch de volgende validaties uit:
1.  **Linting:** ESLint controles.
2.  **Type-checking:** Valideren van de TypeScript compiler.
3.  **Frontend Unit & Integration Tests:** Vitest test suite.
4.  **Database Tests:** Uitvoeren van de pgTAP integratietests op een tijdelijke Supabase container.

---

## 🌿 Git & Release Workflow

Het project hanteert een gestructureerde branching-strategie:

*   **`main`** — Bevat de stabiele productiestand. Wijzigingen op `main` triggeren direct de productie-deploy.
*   **`develop`** — De actieve ontwikkeltak. Alle feature branches worden hierheen gemerged via Pull Requests.

### Richtlijnen voor Pull Requests
1.  Nieuwe features worden als PR aangeboden op `develop`.
2.  Gebruik de issue-koppelingen correct:
    *   Vermeld `Refs #<issue-nummer>` in feature PR's naar `develop`.
    *   Vermeld `Closes #<issue-nummer>` **uitsluitend** in de uiteindelijke Release-PR (`develop` ➔ `main`). Dit voorkomt dat issues vroegtijdig automatisch gesloten worden voordat de code daadwerkelijk live staat. Zie ook het [`PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).
