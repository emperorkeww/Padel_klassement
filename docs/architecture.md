# Architectuur & mappenstructuur

> **Status:** Fase 1 van de refactor ([#329](https://github.com/emperorkeww/Padel/issues/329)) — dit document legt de **doelstructuur en conventies** vast. Er worden in deze fase **geen bestanden verplaatst**; alleen path-aliases zijn geconfigureerd. De fases 2–6 (#331–#335) werken tegen dit document aan.

## 1. Kernprincipes

1. **Scheid generiek van domein.** `src/lib` en `src/components/ui` bevatten **niets** padel-specifieks. Alle domeinlogica en -componenten horen bij hun feature.
2. **Co-locatie.** Component, styling (`.css`), tests (`.test.tsx`) en feature-logica staan bij elkaar per feature.
3. **Consistente data-access.** Elke feature die data ophaalt doet dat via `api.ts` (grote features mogen opsplitsen in `xApi.ts`).
4. **Kleine, reviewbare stappen.** De migratie gebeurt gefaseerd (#331–#335), niet als big-bang.
5. **Geen gedragswijzigingen.** Elke stap blijft groen op `vitest` en de build.

---

## 2. Doel-mappenstructuur

```
src/
  app/                    # routing, providers, app-shell (App, main, layout, nav)
  features/<feature>/
    <Feature>.tsx         # entry-component van de feature
    <Feature>.css
    <Feature>.test.tsx
    components/           # feature-specifieke (sub)componenten + hun css/tests
    api.ts               # data-access voor deze feature
    <domein>.ts          # domeinlogica (+ <domein>.test.ts)
  components/ui/           # ALLEEN generieke, herbruikbare UI
  lib/
    utils/               # format, time, image, errors, ...
    hooks/               # useAsync, useRealtime, useFlip, ...
    supabase/            # client, queryCache, push, database.types
  types/                  # gedeelde, cross-feature types
  test/                   # test-harness (setup, fixtures, mocks) — blijft
  assets/                 # statische assets — blijft
```

---

## 3. Naamconventies

| Onderwerp | Conventie |
|---|---|
| Feature-entry | `PascalCase.tsx` in de feature-root (bv. `Dashboard.tsx`) |
| Feature-subcomponenten | in `features/<x>/components/`, `PascalCase.tsx` |
| Data-access | altijd `api.ts`; splitsen mag als `<onderwerp>Api.ts` bij veel endpoints |
| Domeinlogica | `<domein>.ts` in de feature-root (bv. `elo.ts`) |
| Tests | `.test.ts(x)` **naast** de module (co-locatie), niet in aparte map |
| Styling | `.css` **naast** het component |
| Generieke hooks | `use<Naam>.ts` in `lib/hooks/` |
| Generieke UI | in `components/ui/`, geen padel-termen in naam of inhoud |

---

## 4. Inventarisatie

### 4.1 `src/lib` (88 bestanden = 44 modules + 44 tests)

**Generiek → `lib/utils/`** (domein-onafhankelijk, herbruikbaar)

| Module | Toelichting |
|---|---|
| `format.ts` | tekst-/getalformattering |
| `time.ts` | datum-/tijdhelpers |
| `utils.ts` | algemene helpers |
| `image.ts` | beeldbewerking |
| `errors.ts` | error-normalisatie (door ~9 features gebruikt) |
| `ics.ts` | agenda (ICS) genereren |
| `motion.ts` | animatiehelpers |
| `confetti.ts` | confetti-effect |
| `haptics.ts` | trilfeedback |
| `localFlag.ts` | localStorage feature-flag |
| `theme.ts` | licht/donker-thema |
| `sparkline.ts` | sparkline-berekening (generiek) |
| `shareText.ts` | deel-tekst opbouwen (mechanisme generiek) |
| `shareImage.ts` | deel-afbeelding genereren (mechanisme generiek) |

**React hooks → `lib/hooks/`**

`useAsync.ts` · `useRealtime.ts` · `useFlip.ts` · `useRefetchOnFocus.ts`

**Infrastructuur → `lib/supabase/`**

`supabase.ts` (client) · `queryCache.ts` · `push.ts` · `database.types.ts` (gegenereerd via `npm run gen:types`; CI bewaakt dat het bestand met het schema meeloopt)

**Gedeelde types → `types/`**

`types.ts`

**Domein → verhuizen naar feature** (eenduidige eigenaar)

| Module | Doel-feature |
|---|---|
| `elo.ts` | matches |
| `rankShift.ts`, `pias.ts`, `championPoster.ts` | standings |
| `americano.ts`, `fairTeams.ts`, `zwartePiet.ts`, `maandpiasPoster.ts` | groups |
| `feed.ts`, `coachStats.ts` | feed |
| `roast.ts`, `roastTone.ts`, `nickname.ts` | profiles |

**Domein, cross-cutting → open beslissing (zie §6)** — gebruikt door 3+ features:

`standings.ts`, `results.ts`, `tiers.ts`, `seasons.ts`, `badges.ts`, `missions.ts`, `maandpias.ts`, `upset.ts`, `rivalry.ts`, `predictions.ts`, `trends.ts`, `coachMoments.ts`, `eveningSummary.ts`, `excuses.ts`, `bigDaddy.ts`

### 4.2 `src/components` (49 items)

**Generiek → `components/ui/`**

`Avatar` · `BallIcon` · `CountUp` · `EmptyState` · `Sheet` · `Skeleton` · `Stat` · `Sparkline` · `ToastProvider` (+`Toast.css`) · `CourtTypeIcon` · `ui.css`

**App-shell → `app/`**

`AccountNav` · `DashboardLayout` · `GithubRibbon`

**Domein → verhuizen naar feature**

| Component | Doel-feature |
|---|---|
| `ScoreStepper` | matches |
| `RankChart`, `RatingChart` | profiles |
| `Podium` | standings |
| `TierBadge`, `TierLegend` | standings (tiers) — cross-cutting, zie §6 |
| `FormChips` | standings/rating — cross-cutting, zie §6 |
| `CoachAbout`, `CoachAvatar`, `CoachBubble`, `CoachSneer` + `rudi_avatars/` | coach (in feed) — zie §6 |

### 4.3 `src/features` (huidige staat & op te schonen)

- Features **met** `api.ts`: account, availability, friends, groups, matches, profiles, standings. **Zonder** (data-access inline): dashboard, feed, wrapped, auth → in fase 4 uniform maken.
- `profiles/profile/` heeft al een `components/`-achtige submap (`ProfileHero`, `ProfileStats`, …) → als voorbeeld voor de `components/`-conventie; hernoemen naar `components/`.
- Losse domeinlogica staat al deels goed geco-loceerd (bv. `groups/pollLogic.ts`, `availability/weatherLogic.ts`) — dit is de gewenste eindstaat.

---

## 5. Path-aliases

**Besluit: ja, aliases invoeren.** Motivatie: 431 imports gaan ≥2 niveaus diep (`../../`), 26 zelfs 3. Diepe relatieve paden maken verplaatsen in latere fases foutgevoelig.

**Aliases** (geconfigureerd in `tsconfig.app.json` → `paths` en `vite.config.ts` → `resolve.alias`; vitest erft de Vite-config):

| Alias | Pad |
|---|---|
| `@/` | `src/` |
| `@/lib` | `src/lib` |
| `@/ui` | `src/components/ui` |
| `@/features` | `src/features` |
| `@/types` | `src/types` |

> **Let op:** in deze fase wordt alleen de **configuratie** toegevoegd. Bestaande imports worden **niet** omgezet — dat gebeurt in fase 6 (#335), zodat de diff per fase klein blijft.

---

## 6. Open beslissingen (voor fase 2)

Enkele domeinmodules/-componenten worden door 3+ features gebruikt en horen dus niet in één feature thuis zonder cross-feature import:

- **Rating/scoring-cluster:** `elo`, `standings`, `tiers`, `seasons`, `rankShift`, `results`, `FormChips`, `TierBadge`. Voorstel: een gedeelde `features/rating/` (of `features/scoring/`) feature, waar de rest tegenaan importeert.
- **Coach-cluster:** `Coach*`-componenten + `coachStats`, `coachMoments`, `roastTone`. Voorstel: een `features/coach/`.
- **Overige cross-cutting domeinlogica** (`missions`, `badges`, `upset`, `rivalry`, `predictions`, `trends`, `eveningSummary`, `excuses`, `bigDaddy`): per module bij fase 2 plaatsen bij de meest-eigenaar feature, óf in het rating/coach-cluster indien passend.

Deze keuzes worden definitief gemaakt aan het begin van fase 2 (#331).

---

## 7. Migratievolgorde

| Fase | Issue | Scope |
|---|---|---|
| 1 | #330 | **Dit document** + path-alias-config (geen verplaatsingen) |
| 2 | #331 | `src/lib` opdelen: `utils/`, `hooks/`, `supabase/`; domeinlogica → features |
| 3 | #332 | `src/components` opdelen: `ui/` (generiek) + domein-componenten → features |
| 4 | #333 | Feature-conventies uniform (`api.ts`, co-locatie tests/styles) |
| 5 | #334 | Grote bestanden opsplitsen (Dashboard, Leaderboard, PlanPoll, Feed, GroupDetail, badges) |
| 6 | #335 | Imports opschonen + relatieve paden → aliases |

Elke fase = één (of enkele kleine) PR('s) naar `develop`, groen op tests + build, zonder functionele of visuele wijziging.
