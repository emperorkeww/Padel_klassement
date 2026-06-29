/* =========================================================================
   SHARED STATE + SMALL HELPERS
   The live tournament lives on a `store` object whose properties we mutate, so
   every script shares the same state. Loaded as a classic script (global
   scope), so these names are visible to the scripts loaded after it.
   ========================================================================= */

const store = {
  state: null,   // null until a tournament is generated: { mode, players, teams, schedule }
  draft: {       // pre-generation setup
    players: [],            // {id,name}
    mode: 'dynamic',
    numMatches: 6,
    pairs: [],             // fixed mode: array of [idOrNull, idOrNull]
  },
};

let nextId = 1;
const uid = () => 'p' + (nextId++);

/* DOM + escaping helpers */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* state lookups (assume store.state is populated) */
function playerName(id){ const p = store.state.players.find(p => p.id === id); return p ? p.name : '—'; }
function teamLabel(id){ const t = store.state.teams.find(t => t.id === id); return t ? (playerName(t.p1) + ' & ' + playerName(t.p2)) : '—'; }
function activeIndex(){ return store.state.schedule.findIndex(m => !m.result); }

/* =========================================================================
   SERIALISATION (export / save / resume share one shape)
   ========================================================================= */
function serialise(){
  const s = store.state;
  return { version: 1, mode: s.mode, players: s.players, teams: s.teams, schedule: s.schedule };
}
function deserialise(obj){
  if (!obj || !obj.schedule || !obj.mode) return false;
  store.state = { mode: obj.mode, players: obj.players || [], teams: obj.teams || [], schedule: obj.schedule };
  return true;
}
