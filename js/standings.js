/* =========================================================================
   STANDINGS
   Aggregates completed match results into a ranked table. In dynamic mode the
   entities are individual players; in fixed mode they are the pairs (teams).
   ========================================================================= */

/* Depends on globals from state.js (store, teamLabel) and results.js (PTS_*). */

function blankRow(id, label){
  return { id, label, MP:0, W:0, D:0, L:0, GW:0, GL:0, Pts:0 };
}

function computeStandings(){
  const state = store.state;
  const rows = {};
  if (state.mode === 'dynamic'){
    state.players.forEach(p => rows[p.id] = blankRow(p.id, p.name));
  } else {
    state.teams.forEach(t => rows[t.id] = blankRow(t.id, teamLabel(t.id)));
  }

  for (const match of state.schedule){
    if (!match.result) continue;
    const r = match.result;
    // entities on each side
    const sideA = state.mode === 'dynamic' ? match.teamA : [match.teamA];
    const sideB = state.mode === 'dynamic' ? match.teamB : [match.teamB];

    const apply = (ids, gw, gl, outcome) => {
      for (const id of ids){
        const row = rows[id]; if (!row) continue;
        row.MP++; row.GW += gw; row.GL += gl;
        if (outcome === 'W'){ row.W++; row.Pts += PTS_WIN; }
        else if (outcome === 'D'){ row.D++; row.Pts += PTS_DRAW; }
        else { row.L++; row.Pts += PTS_LOSS; }
      }
    };
    const aOut = r.winner === 'A' ? 'W' : r.winner === 'draw' ? 'D' : 'L';
    const bOut = r.winner === 'B' ? 'W' : r.winner === 'draw' ? 'D' : 'L';
    apply(sideA, r.gamesA, r.gamesB, aOut);
    apply(sideB, r.gamesB, r.gamesA, bOut);
  }

  return Object.values(rows).sort((x, y) =>
    y.Pts - x.Pts ||
    (y.GW - y.GL) - (x.GW - x.GL) ||
    y.GW - x.GW ||
    x.label.localeCompare(y.label)
  );
}
