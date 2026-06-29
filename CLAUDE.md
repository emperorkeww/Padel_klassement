# CLAUDE.md

Guidance for working in this repository.

## Overview

**Padel Tournament Manager** — a framework-free, client-only web app for running 2-v-2 padel tournaments. Add players, generate a balanced match schedule, enter set scores court-side, and watch a live standings table update. Everything runs in the browser; there is no backend.

The app is plain HTML + custom CSS + vanilla JS, split into several classic `<script>` files (global scope, no bundler). There is no build step, package manager, or test suite.

## Running

Just open `index.html` in a browser — double-clicking works (it runs from `file://`; the scripts are plain `<script>` tags, not ES modules). A local server (`python3 -m http.server 8000`) is optional and handy while editing.

External dependencies are CDN-loaded at runtime:
- **Tailwind CSS** (`cdn.tailwindcss.com`) — used only for responsive layout utilities; the theme and all signature components are custom CSS in the `<style>` block.
- **Google Fonts** — Space Grotesk (display/headings), Inter (body), Space Mono (numbers/labels).

## Layout

`index.html` loads the scripts in dependency order (each defines globals the later ones use); `app.js` is last and calls `init()`:

```
index.html          markup only; links css/styles.css + the js/ scripts (in order)
css/styles.css      custom design system (theme tokens, scoreboard, standings…)
js/  (load order ↓)
  storage.js        localStorage wrapper (key padel-tournament-v1, fails gracefully)
  scheduling.js     generateDynamicSchedule / generateFixedSchedule (pure)
  results.js        computeResult + points constants (pure)
  state.js          shared store + $/esc/lookup helpers + serialise/deserialise
  standings.js      computeStandings → ranked rows
  render.js         all DOM rendering (setup + tournament screens)
  app.js            entry point (last): actions, event wiring, init()
docs/architecture.md  script graph + data shapes
```

If you add a script, insert its `<script>` tag in `index.html` after the scripts it depends on and before the ones that use it (and always before `app.js`).

## Architecture

Scripts are split by responsibility and share one global scope; `js/state.js` is the hub everything depends on.

- **Shared state** (`state.js`) — the live tournament lives on a `store` object whose properties are mutated (so every script sees the same state):
  - `store.draft` — pre-generation setup (players, mode, match count, fixed pairs).
  - `store.state` — the live tournament (`null` until generated): `{ mode, players, teams, schedule }`.
  Also holds `$`, `esc`, the `playerName`/`teamLabel`/`activeIndex` lookups, and `serialise`/`deserialise`.
- **Persistence** (`storage.js`) — wraps `localStorage` under key `padel-tournament-v1`; try/catch so it degrades gracefully in sandboxes. Saved automatically on every `renderTournament`.
- **Scheduling** (`scheduling.js`) — `generateDynamicSchedule` and `generateFixedSchedule`. Pure functions.
- **Result logic** (`results.js`) — `computeResult` validates and scores a single match. Pure.
- **Standings** (`standings.js`) — `computeStandings` aggregates results into a ranked table.
- **Rendering** (`render.js`) — setup + tournament rendering (`renderPlayers`, `renderPairs`, `setMode`, `renderTournament`, `renderMatches`, `renderStandings`); all `innerHTML` string templating.
- **Actions + wiring** (`app.js`) — add/remove players, generate, submit/edit match, export/import JSON, reset; mostly delegated listeners on container elements (`matchList`, `playerList`, `pairList`); `init()` runs on load.

There are two views toggled by `.hidden`: `#setup` and `#tournament`.

## Two tournament modes

- **Dynamic teams** (`mode: 'dynamic'`) — players are re-paired every match so partners and opponents stay fresh. The board ranks **individuals**.
- **Fixed pairs** (`mode: 'fixed'`) — players are locked into 2-person duos for the whole event. The board ranks **pairs** (`teams`).

## Scheduling logic

Both algorithms use the same core trick: a large multiplier `W_PLAY = 1000` makes **play-count balance a near-hard constraint** (the least-played entity almost always gets picked next), with smaller weights breaking ties:
- `W_PARTNER = 3` — penalizes repeating a partner.
- `W_OPP = 1` — penalizes repeating an opponent (cheaper than repeating a partner).
- `Math.random()` jitter is added only to break exact cost ties.

Dynamic mode picks 4 individuals by cost, then evaluates all 3 ways to split them into two teams and picks the lowest-overlap partition. Fixed mode treats each duo as atomic and picks 2 duos per match.

Unordered pairs are keyed with `pk(a, b)` (sorted `a|b` string) throughout.

## Scoring rules

- A match is two sets; each set must have a winner (no tied sets allowed — validated in `computeResult`).
- 2–0 in sets → that side wins. 1–1 → decided by an optional **match tiebreak**; if no tiebreak is entered, it's a **draw**.
- Standings points: **Win 3 · Draw 1 · Loss 0** (`PTS_WIN`/`PTS_DRAW`/`PTS_LOSS`).
- Ranking sort: points → game difference (GD = games won − lost) → games won → name.
- **GD counts only games from completed sets** — the match tiebreak decides the match but is *not* counted as games.

## Data / serialization

`serialise()` produces `{ version: 1, mode, players, teams, schedule }`. The same shape is used for `localStorage` autosave and for Export/Import (downloaded as `padel-tournament-<timestamp>.json`). `deserialise()` does light validation (`schedule` + `mode` must exist) and is shared by import and resume.

## Conventions when editing

- **No frameworks, no build.** Keep it vanilla JS in classic scripts (global scope). New code goes in the script that matches its responsibility (see Layout); keep `scheduling.js`/`results.js` pure (no DOM, no `store`). Adding a script means adding a `<script>` tag in `index.html` in the right order.
- Rendering is string-templated `innerHTML`. Any user-supplied text (player names) **must** go through `esc()` to prevent HTML injection.
- DOM lookups use the `$` helper (a global from `state.js`). Watch for name collisions — every top-level `const`/`function` shares one global scope.
- Prefer delegated event listeners on stable containers over per-element wiring (matches its `data-*` attribute pattern: `data-submit`, `data-edit`, `data-step`/`data-target`, `data-remove`, `data-pair-slot`).
- The custom design system lives in the `:root` CSS variables and the Tailwind `theme.extend.colors` block — reuse those tokens (`--court`, `--glass`, `--ball`, etc.) rather than hardcoding new colors.
- Respects `prefers-reduced-motion` (animations/transitions disabled) — keep new motion behind that guard.
- Number inputs use `font-size:16px` and a custom stepper to avoid mobile zoom and native spinners; keep court-side mobile usability in mind.
