/* =========================================================================
   RENDERING
   All views are string-templated via innerHTML. Any user-supplied text (player
   names) MUST pass through esc() to avoid HTML injection. Two screens toggle
   via the `hidden` class: #setup and #tournament.
   ========================================================================= */

/* Depends on globals from state.js (store, $, esc, playerName, teamLabel,
   activeIndex, serialise), standings.js (computeStandings) and storage.js. */

/* ---------------------------------------------------------------------------
   SETUP SCREEN
   --------------------------------------------------------------------------- */
function renderPlayers(){
  const draft = store.draft;
  $('playerCount').textContent = draft.players.length + ' added';
  $('playerList').innerHTML = draft.players.map(p => `
    <span class="chip" data-id="${p.id}">
      ${esc(p.name)}
      <button type="button" data-remove="${p.id}" aria-label="Remove ${esc(p.name)}">×</button>
    </span>`).join('') || '<span class="hint">No players yet.</span>';
  updatePerPlayerHint();
  if (draft.mode === 'fixed') renderPairs();
}

function updatePerPlayerHint(){
  const draft = store.draft;
  const N = draft.players.length, M = draft.numMatches;
  if (draft.mode === 'dynamic'){
    if (N >= 4){
      const avg = (4 * M / N);
      $('perPlayerHint').textContent = '≈ ' + avg.toFixed(1) + ' matches per player';
    } else $('perPlayerHint').textContent = '';
  } else {
    const teams = Math.floor(N / 2);
    if (teams >= 2){
      const avg = (2 * M / teams);
      $('perPlayerHint').textContent = teams + ' pairs · ≈ ' + avg.toFixed(1) + ' matches per pair';
    } else $('perPlayerHint').textContent = '';
  }
}

function renderPairs(){
  const draft = store.draft;
  const N = draft.players.length;
  const teamCount = Math.floor(N / 2);
  // normalise pair array length
  if (draft.pairs.length !== teamCount){
    draft.pairs = [];
    const ids = draft.players.map(p => p.id);
    for (let i = 0; i < teamCount; i++) draft.pairs.push([ids[2*i] ?? null, ids[2*i+1] ?? null]);
  }
  const options = sel => draft.players.map(p =>
    `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

  $('pairList').innerHTML = draft.pairs.map((pair, i) => `
    <div class="flex items-center gap-2" data-pair="${i}">
      <span class="rank" style="background:#103a4f;color:#C9F23E">${i+1}</span>
      <select class="field" data-pair-slot="${i}-0">${options(pair[0])}</select>
      <span class="vs">&amp;</span>
      <select class="field" data-pair-slot="${i}-1">${options(pair[1])}</select>
    </div>`).join('') || '<p class="hint">Add at least 4 players to form pairs.</p>';

  const leftover = N - teamCount * 2;
  $('pairError').classList.add('hidden');
  if (leftover > 0){
    $('pairError').textContent = 'Heads-up: ' + leftover + ' player(s) won’t be assigned to a pair (odd number of players).';
    $('pairError').classList.remove('hidden');
  }
}

function setMode(mode){
  store.draft.mode = mode;
  $('modeDynamic').setAttribute('aria-pressed', mode === 'dynamic');
  $('modeFixed').setAttribute('aria-pressed', mode === 'fixed');
  $('modeHelp').textContent = mode === 'dynamic'
    ? 'Every match re-pairs players so partners and opponents stay fresh and everyone plays a balanced number of games. The board ranks individuals.'
    : 'Players are locked into 2-person pairs for the whole event. The board ranks pairs.';
  $('pairSetup').classList.toggle('hidden', mode !== 'fixed');
  if (mode === 'fixed') renderPairs();
  updatePerPlayerHint();
}

/* ---------------------------------------------------------------------------
   TOURNAMENT SCREEN
   --------------------------------------------------------------------------- */
function renderTournament(flashStandings){
  const state = store.state;
  $('setup').classList.add('hidden');
  $('tournament').classList.remove('hidden');

  $('modeTag').textContent = state.mode === 'dynamic' ? 'Dynamic teams · individual ranking' : 'Fixed pairs · pair ranking';
  $('standingsScope').textContent = state.mode === 'dynamic' ? 'players' : 'pairs';

  const total = state.schedule.length;
  const done = state.schedule.filter(m => m.result).length;
  $('progressText').textContent = done + ' / ' + total + ' played';
  $('progressFill').style.width = (total ? (done / total * 100) : 0) + '%';

  renderMatches();
  renderStandings(flashStandings);
  storage.save(serialise());
}

function teamHtml(match, side){
  const state = store.state;
  if (state.mode === 'dynamic'){
    const ids = side === 'A' ? match.teamA : match.teamB;
    return `<div class="team-name">${esc(playerName(ids[0]))}<br>${esc(playerName(ids[1]))}</div>`;
  } else {
    const id = side === 'A' ? match.teamA : match.teamB;
    const t = state.teams.find(t => t.id === id);
    return `<div class="team-name">${esc(playerName(t.p1))}<br>${esc(playerName(t.p2))}</div>`;
  }
}

function plate(a, b){
  return `<span class="scoreplate"><span class="scoredigit">${a}</span><span class="scoresep">:</span><span class="scoredigit">${b}</span></span>`;
}

function renderMatches(){
  const state = store.state;
  const active = activeIndex();
  $('matchList').innerHTML = state.schedule.map((m, i) => {
    const isActive = i === active;
    const locked = !!m.result;
    const cls = 'match ' + (locked ? 'locked' : (isActive ? 'active' : ''));
    const badge = locked
      ? '<span class="badge badge-done">Final</span>'
      : (isActive ? '<span class="badge badge-live">Up next</span>' : '<span class="badge badge-todo">Scheduled</span>');

    const winA = locked && m.result.winner === 'A';
    const winB = locked && m.result.winner === 'B';
    const draw = locked && m.result.winner === 'draw';

    // teams row
    const teamsRow = `
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
        <div class="${winA ? '' : ''}">
          ${teamHtml(m,'A')}
          ${winA ? '<span class="badge badge-done mt-1 inline-block">Won</span>' : ''}
          ${draw ? '<span class="badge badge-todo mt-1 inline-block">Draw</span>' : ''}
        </div>
        <div class="vs text-center">VS</div>
        <div class="text-right">
          ${teamHtml(m,'B')}
          ${winB ? '<span class="badge badge-done mt-1 inline-block">Won</span>' : ''}
          ${draw ? '<span class="badge badge-todo mt-1 inline-block">Draw</span>' : ''}
        </div>
      </div>`;

    if (locked){
      const r = m.result;
      const tbHtml = r.tb ? `<div class="text-center"><div class="setcol-label mb-1">Tiebreak</div>${plate(r.tb[0], r.tb[1])}</div>` : '';
      return `<div class="${cls}" data-match="${i}">
        <div class="match-head"><span class="match-no">MATCH ${i+1}</span>${badge}</div>
        ${teamsRow}
        <div class="flex items-center justify-center gap-5 px-4 pb-3 flex-wrap">
          <div class="text-center"><div class="setcol-label mb-1">Set 1</div>${plate(r.s1[0], r.s1[1])}</div>
          <div class="text-center"><div class="setcol-label mb-1">Set 2</div>${plate(r.s2[0], r.s2[1])}</div>
          ${tbHtml}
          <button class="btn btn-ghost" style="font-size:13px;padding:8px 12px" data-edit="${i}">Edit</button>
        </div>
      </div>`;
    }

    // editable score entry
    const stp = (key) => `
      <div class="stepper">
        <button type="button" data-step="-1" data-target="${key}">−</button>
        <input id="${key}" type="number" inputmode="numeric" min="0" max="99" value="" />
        <button type="button" data-step="1" data-target="${key}">+</button>
      </div>`;
    const base = 'm' + i;
    return `<div class="${cls}" data-match="${i}">
      <div class="match-head"><span class="match-no">MATCH ${i+1}</span>${badge}</div>
      ${teamsRow}
      <div class="px-4 pb-4">
        <div class="grid grid-cols-3 gap-3 items-end">
          <div><div class="setcol-label mb-1 text-center">Set 1</div><div class="flex justify-center gap-2"><div>${stp(base+'-s1a')}</div></div></div>
          <div><div class="setcol-label mb-1 text-center">Set 2</div><div class="flex justify-center gap-2"><div>${stp(base+'-s2a')}</div></div></div>
          <div><div class="setcol-label mb-1 text-center">Tiebreak</div><div class="flex justify-center gap-2"><div>${stp(base+'-tba')}</div></div></div>
        </div>
        <div class="grid grid-cols-3 gap-3 items-start mt-2">
          <div class="flex justify-center">${stp(base+'-s1b')}</div>
          <div class="flex justify-center">${stp(base+'-s2b')}</div>
          <div class="flex justify-center">${stp(base+'-tbb')}</div>
        </div>
        <p class="hint text-center mt-2">Top row = left team · bottom row = right team. Tiebreak only used if sets are split 1–1 (leave blank for a draw).</p>
        <p class="err text-center mt-1 hidden" data-error="${i}"></p>
        <div class="flex justify-center mt-3">
          <button class="btn btn-primary" data-submit="${i}">Submit result</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderStandings(flash){
  const rows = computeStandings();
  $('standingsBody').innerHTML = rows.map((r, i) => {
    const gd = r.GW - r.GL;
    const gdCls = gd > 0 ? 'gd-pos' : gd < 0 ? 'gd-neg' : '';
    const rankCls = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
    return `<tr>
      <td class="name"><span class="rank ${rankCls}">${i+1}</span>${esc(r.label)}</td>
      <td>${r.MP}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td>
      <td class="${gdCls}">${gd > 0 ? '+' : ''}${gd}</td>
      <td class="pts">${r.Pts}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" class="hint" style="text-align:left">No results yet.</td></tr>';

  if (flash){
    const body = $('standingsBody');
    body.classList.remove('flash'); void body.offsetWidth; body.classList.add('flash');
  }
}
