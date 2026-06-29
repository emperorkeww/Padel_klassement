# Architecture

How the Padel Tournament Manager is put together. The app is a static, client-only
project built from plain `<script>` files (no backend, no bundler, no build step).

## Script graph

`index.html` loads the scripts in dependency order; each one defines globals (in the
shared global scope) that the later scripts use. `app.js` runs last and calls `init()`.

```
index.html
  └─ css/styles.css       (design system)
  └─ js/ (loaded in this order)
       storage.js         localStorage wrapper
       scheduling.js      generateDynamic / generateFixed
       results.js         computeResult, points constants
       state.js           store + helpers + serialise/deserialise   ← hub
       standings.js       computeStandings   (uses store, results)
       render.js          all DOM rendering  (uses store, standings, storage)
       app.js             actions, event wiring, init()  (uses everything)
```

`state.js` is the hub: it owns the mutable `store` ( `{ state, draft }` ) plus the
small `$` / `esc` / lookup helpers, so every later script can use them.

## Why a `store` object

The live tournament is held as `store.state` and reassigned by mutating that property
(`store.state = …`) rather than as a free `let state` variable. This keeps a single
shared reference that every script reads through, and makes the "current tournament"
explicit. Same for the pre-generation `store.draft`.

## Why classic scripts (not ES modules)

So `index.html` can be opened straight from `file://` (double-click) — browsers block
ES-module `import` over `file://`. The trade-off: all top-level names share one global
scope, so avoid name collisions and mind the load order in `index.html`.

## Data shapes

```js
// draft (before generation)
{ players: [{id, name}], mode: 'dynamic'|'fixed', numMatches: Number, pairs: [[idA, idB], …] }

// state (live tournament) — also the serialised export shape (+ version: 1)
{
  mode: 'dynamic' | 'fixed',
  players: [{ id, name }],
  teams:   [{ id, p1, p2 }],          // fixed mode only
  schedule: [
    {
      id: 'm1',
      teamA: [idA, idB] | teamId,      // array of ids (dynamic) or a team id (fixed)
      teamB: [idC, idD] | teamId,
      result: null | {
        s1: [a, b], s2: [a, b],        // set scores
        tb: [a, b] | null,             // match tiebreak (only when sets split 1–1)
        winner: 'A' | 'B' | 'draw',
        gamesA, gamesB                  // total games per side (sets only)
      }
    }
  ]
}
```

## Render flow

User action (in `app.js`) → mutate `store` → call a `render*` function in `render.js`
→ `renderTournament()` repaints matches + standings and autosaves via `storage.save(serialise())`.

Rendering is plain `innerHTML` string templating. Anything containing user input
(player names) is passed through `esc()` to prevent HTML injection. Event handling
uses delegated listeners on stable containers (`#matchList`, `#playerList`, `#pairList`)
keyed off `data-*` attributes.

See `CLAUDE.md` at the repo root for editing conventions.
