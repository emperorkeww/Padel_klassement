# 🎾 Padel Tournament Manager

A small, framework-free web app for running **2-v-2 padel tournaments** court-side. Add players, generate a balanced schedule, punch in set scores between matches, and watch a live standings table sort itself. Everything runs in the browser — no backend, no accounts, no build step.

## Features

- **Two formats**
  - **Dynamic teams** — players are re-paired every match so partners and opponents stay fresh and everyone plays a balanced number of games. The board ranks **individuals**.
  - **Fixed pairs** — players are locked into 2-person pairs for the whole event. The board ranks **pairs**.
- **Balanced scheduling** — the generator keeps play counts even and minimizes repeated partners/opponents.
- **Court-side score entry** — big steppers, mobile-friendly, set + tiebreak input with validation.
- **Live standings** — points, wins/draws/losses, game difference, automatically sorted.
- **Saves locally** — progress is kept in `localStorage`; reopen the page to resume.
- **Export / Import** — download a tournament as JSON to back it up or move it between devices.

## Running

It's a static site — no install or build.

- **Quickest:** double-click `index.html` (or open it in any browser). It works straight from the `file://` protocol — the JavaScript is loaded as plain `<script>` files, not modules.
- **With a local server** (optional, handy while editing):
  ```bash
  # from the project root
  python3 -m http.server 8000
  # then visit http://localhost:8000
  ```
  Any static server works (`npx serve`, VS Code Live Server, etc.).

There are no dependencies to install. Tailwind CSS and Google Fonts are loaded from a CDN at runtime, so the app needs an internet connection for full styling.

## Project structure

```
Padel/
├── index.html          # markup only — links the CSS + loads the js/ scripts in order
├── css/
│   └── styles.css       # custom design system (theme, scoreboard, standings…)
├── js/                  # plain scripts (global scope), loaded in dependency order
│   ├── storage.js       # localStorage wrapper (fails gracefully)
│   ├── scheduling.js    # dynamic + fixed schedule generators
│   ├── results.js       # validate set scores → match result
│   ├── state.js         # shared store + DOM/escaping helpers + serialisation
│   ├── standings.js     # aggregate results → ranked table
│   ├── render.js        # all DOM rendering (setup + tournament screens)
│   └── app.js           # entry point (loaded last): actions, event wiring, init
├── assets/              # static assets (icons, images)
├── docs/                # extra documentation
├── README.md
├── LICENSE
├── CLAUDE.md            # guidance for AI assistants working in this repo
└── .gitignore
```

Tailwind is used only for responsive layout utilities; the theme and all signature components (court-line header, scoreboard, standings table) are hand-written CSS in `css/styles.css`.

## How it works

### Scheduling

Both schedulers share one trick: the play-count weight is huge (`W_PLAY = 1000`), so balancing how often each entity plays is effectively a hard constraint. Smaller weights break ties — repeating a **partner** (`W_PARTNER = 3`) is penalized more than repeating an **opponent** (`W_OPP = 1`) — and a tiny random jitter only breaks exact cost ties.

- **Dynamic** picks the 4 least-"costly" individuals per match, then evaluates all 3 ways to split them into two teams and keeps the lowest-overlap pairing.
- **Fixed** treats each pair as atomic and picks the 2 least-played pairs with the fewest prior matchups.

### Scoring

- A match is **two sets**; neither set may be tied.
- **2–0 in sets** → that side wins. **1–1** → decided by an optional **match tiebreak**; if no tiebreak is entered, the match is a **draw**.
- Standings points: **Win 3 · Draw 1 · Loss 0**.
- Ranking sort: points → game difference (games won − lost) → games won → name.
- Game difference counts only games from completed sets — the match tiebreak decides the match but is **not** counted as games.

## Data & privacy

The app is fully client-side. Tournament data lives only in your browser's `localStorage` (key `padel-tournament-v1`) plus any JSON files you export. Nothing is sent to a server.

## License

[MIT](LICENSE) © 2026 Remco Marien
