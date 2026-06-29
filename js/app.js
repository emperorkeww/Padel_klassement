/* =========================================================================
   APP ENTRY — actions, event wiring, init
   Loaded LAST (after all other scripts and the DOM). It ties the pieces
   together: user actions mutate the global `store`, then ask the render
   functions to repaint. Uses globals defined by the earlier scripts
   (state.js, storage.js, scheduling.js, results.js, render.js).
   ========================================================================= */

/* =========================================================================
   ACTIONS
   ========================================================================= */
function addPlayerFromInput(){
  const inp = $('playerInput');
  const name = inp.value.trim();
  if (!name) return;
  if (store.draft.players.some(p => p.name.toLowerCase() === name.toLowerCase())){
    inp.classList.add('err'); setTimeout(() => inp.classList.remove('err'), 600);
    return;
  }
  store.draft.players.push({ id: uid(), name });
  inp.value = ''; inp.focus();
  renderPlayers();
}

function generate(){
  $('setupError').classList.add('hidden');
  const draft = store.draft;
  const N = draft.players.length;
  const M = draft.numMatches;

  if (draft.mode === 'dynamic'){
    if (N < 4) return showSetupError('Add at least 4 players for dynamic teams.');
    store.state = { mode: 'dynamic', players: draft.players.slice(), teams: [], schedule: generateDynamicSchedule(draft.players.map(p => p.id), M) };
  } else {
    // build teams from pair selections; validate
    const pairs = draft.pairs;
    if (pairs.length < 2) return showSetupError('Need at least 2 pairs (4 players) for fixed teams.');
    const used = new Set(); const teams = [];
    for (let i = 0; i < pairs.length; i++){
      const [a, b] = pairs[i];
      if (!a || !b) return showSetupError('Every pair needs two players.');
      if (a === b) return showSetupError('Pair ' + (i+1) + ' has the same player twice.');
      if (used.has(a) || used.has(b)) return showSetupError('A player is assigned to more than one pair.');
      used.add(a); used.add(b);
      teams.push({ id: 't' + (i+1), p1: a, p2: b });
    }
    store.state = { mode: 'fixed', players: draft.players.slice(), teams, schedule: generateFixedSchedule(teams.map(t => t.id), M) };
  }
  renderTournament(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSetupError(msg){ const e = $('setupError'); e.textContent = msg; e.classList.remove('hidden'); }

function regenerate(){
  const state = store.state;
  const played = state.schedule.some(m => m.result);
  if (played && !confirm('Regenerate the schedule? Entered results will be cleared.')) return;
  const M = state.schedule.length;
  state.schedule = state.mode === 'dynamic'
    ? generateDynamicSchedule(state.players.map(p => p.id), M)
    : generateFixedSchedule(state.teams.map(t => t.id), M);
  renderTournament(true);
}

function submitMatch(i){
  const base = 'm' + i;
  const num = key => { const v = $(base + key).value; return v === '' ? null : parseInt(v, 10); };
  const pair = (ak, bk) => {
    const a = num(ak), b = num(bk);
    if (a === null && b === null) return null;
    return [a === null ? 0 : a, b === null ? 0 : b];
  };
  const s1 = pair('-s1a', '-s1b');
  const s2 = pair('-s2a', '-s2b');
  const tb = pair('-tba', '-tbb');

  const errEl = document.querySelector(`[data-error="${i}"]`);
  errEl.classList.add('hidden');

  const res = computeResult(s1 || [NaN, NaN], s2 || [NaN, NaN], tb);
  if (res.error){ errEl.textContent = res.error; errEl.classList.remove('hidden'); return; }

  store.state.schedule[i].result = res;
  renderTournament(true);
}

function editMatch(i){ store.state.schedule[i].result = null; renderTournament(false); }

function exportJSON(){
  const data = JSON.stringify(serialise(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.href = url; a.download = 'padel-tournament-' + stamp + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const obj = JSON.parse(reader.result);
      if (deserialise(obj)){ renderTournament(false); window.scrollTo({top:0,behavior:'smooth'}); }
      else alert('That file doesn’t look like a saved tournament.');
    }catch(_){ alert('Couldn’t read that file.'); }
  };
  reader.readAsText(file);
}

function resetTournament(){
  if (!confirm('Start a new tournament? This clears the current board.')) return;
  storage.clear();
  store.state = null;
  $('tournament').classList.add('hidden');
  $('setup').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =========================================================================
   EVENT WIRING
   ========================================================================= */
// players
$('addPlayer').addEventListener('click', addPlayerFromInput);
$('playerInput').addEventListener('keydown', e => { if (e.key === 'Enter') addPlayerFromInput(); });
$('playerList').addEventListener('click', e => {
  const id = e.target.getAttribute('data-remove');
  if (id){ store.draft.players = store.draft.players.filter(p => p.id !== id); renderPlayers(); }
});

// mode toggle
$('modeDynamic').addEventListener('click', () => setMode('dynamic'));
$('modeFixed').addEventListener('click', () => setMode('fixed'));

// match count
$('numMatches').addEventListener('input', e => {
  let v = parseInt(e.target.value, 10); if (isNaN(v)) return;
  store.draft.numMatches = Math.max(1, Math.min(200, v)); updatePerPlayerHint();
});
$('mMinus').addEventListener('click', () => { store.draft.numMatches = Math.max(1, store.draft.numMatches - 1); $('numMatches').value = store.draft.numMatches; updatePerPlayerHint(); });
$('mPlus').addEventListener('click', () => { store.draft.numMatches = Math.min(200, store.draft.numMatches + 1); $('numMatches').value = store.draft.numMatches; updatePerPlayerHint(); });

// pair selects + shuffle
$('pairList').addEventListener('change', e => {
  const slot = e.target.getAttribute('data-pair-slot');
  if (!slot) return;
  const [i, j] = slot.split('-').map(Number);
  store.draft.pairs[i][j] = e.target.value;
});
$('shufflePairs').addEventListener('click', () => {
  const ids = store.draft.players.map(p => p.id);
  for (let i = ids.length - 1; i > 0; i--){ const k = Math.floor(Math.random() * (i + 1)); [ids[i], ids[k]] = [ids[k], ids[i]]; }
  const teamCount = Math.floor(ids.length / 2);
  store.draft.pairs = [];
  for (let i = 0; i < teamCount; i++) store.draft.pairs.push([ids[2*i], ids[2*i+1]]);
  renderPairs();
});

// generate / resume
$('generate').addEventListener('click', generate);
$('loadSaved').addEventListener('click', () => {
  const saved = storage.load();
  if (saved && deserialise(saved)){ renderTournament(false); window.scrollTo({top:0,behavior:'smooth'}); }
});

// tournament controls
$('regenBtn').addEventListener('click', regenerate);
$('exportBtn').addEventListener('click', exportJSON);
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; });
$('resetBtn').addEventListener('click', resetTournament);

// match list: delegated steppers / submit / edit
$('matchList').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.step){
    const input = $(t.dataset.target);
    let v = parseInt(input.value, 10); if (isNaN(v)) v = 0;
    v = Math.max(0, Math.min(99, v + parseInt(t.dataset.step, 10)));
    input.value = v;
    return;
  }
  if (t.dataset.submit !== undefined && t.dataset.submit !== null && t.hasAttribute('data-submit')){ submitMatch(parseInt(t.dataset.submit, 10)); return; }
  if (t.hasAttribute('data-edit')){ editMatch(parseInt(t.dataset.edit, 10)); return; }
});

/* =========================================================================
   INIT
   ========================================================================= */
function init(){
  setMode('dynamic');
  renderPlayers();
  // offer to resume a saved tournament if one exists
  const saved = storage.load();
  if (saved && saved.schedule){
    $('loadSaved').classList.remove('hidden');
  }
}
init();
