/* =========================================================================
   SCHEDULING ALGORITHMS
   Both schedulers share one trick: the play-count weight (W_PLAY) is huge, so
   balancing how often each entity plays is effectively a hard constraint. The
   smaller partner/opponent weights only break ties between equally-played
   candidates; the random jitter only breaks *exact* cost ties.
   ========================================================================= */

const W_PLAY = 1000;   // play-count dominates: balance is a hard constraint
const W_PARTNER = 3;   // repeating a partner is worse...
const W_OPP = 1;       // ...than repeating an opponent

/* unordered-pair key */
const pk = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

/* Dynamic: choose 4 individuals per match, then split into 2 teams.
   - Play balance enforced via W_PLAY multiplier (less-played always wins).
   - Overlap penalties break ties between equally-played players. */
function generateDynamicSchedule(playerIds, M){
  const play = {}; playerIds.forEach(p => play[p] = 0);
  const partner = {};   // pk -> count
  const oppon   = {};   // pk -> count
  const g = (m, a, b) => m[pk(a, b)] || 0;
  const inc = (m, a, b) => { m[pk(a, b)] = (m[pk(a, b)] || 0) + 1; };

  const schedule = [];

  for (let m = 0; m < M; m++){
    // ---- pick 4 players ----
    const chosen = [];
    while (chosen.length < 4){
      let best = null, bestCost = Infinity;
      for (const p of playerIds){
        if (chosen.includes(p)) continue;
        let interaction = 0;
        for (const c of chosen) interaction += W_PARTNER * g(partner, p, c) + W_OPP * g(oppon, p, c);
        const cost = W_PLAY * play[p] + interaction + Math.random(); // jitter only breaks exact ties
        if (cost < bestCost){ bestCost = cost; best = p; }
      }
      chosen.push(best);
    }

    // ---- split the 4 into two teams (3 possible partitions) ----
    const [a, b, c, d] = chosen;
    const partitions = [
      { A:[a,b], B:[c,d] },
      { A:[a,c], B:[b,d] },
      { A:[a,d], B:[b,c] },
    ];
    let bestPart = null, bestPartCost = Infinity;
    for (const part of partitions){
      const partnerCost = g(partner, part.A[0], part.A[1]) + g(partner, part.B[0], part.B[1]);
      let oppCost = 0;
      for (const x of part.A) for (const y of part.B) oppCost += g(oppon, x, y);
      const cost = W_PARTNER * partnerCost + W_OPP * oppCost + Math.random();
      if (cost < bestPartCost){ bestPartCost = cost; bestPart = part; }
    }

    // ---- commit ----
    chosen.forEach(p => play[p]++);
    inc(partner, bestPart.A[0], bestPart.A[1]);
    inc(partner, bestPart.B[0], bestPart.B[1]);
    for (const x of bestPart.A) for (const y of bestPart.B) inc(oppon, x, y);

    schedule.push({ id: 'm' + (m + 1), teamA: bestPart.A.slice(), teamB: bestPart.B.slice(), result: null });
  }
  return schedule;
}

/* Fixed: duos are atomic. Pick 2 duos per match, balancing play counts and
   minimizing repeated matchups (same W_PLAY dominance trick). */
function generateFixedSchedule(teamIds, M){
  const play = {}; teamIds.forEach(t => play[t] = 0);
  const matchup = {}; // pk -> count
  const g = (a, b) => matchup[pk(a, b)] || 0;
  const inc = (a, b) => { matchup[pk(a, b)] = g(a, b) + 1; };

  const schedule = [];
  for (let m = 0; m < M; m++){
    // first team: least played
    let t1 = null, c1 = Infinity;
    for (const t of teamIds){ const c = W_PLAY * play[t] + Math.random(); if (c < c1){ c1 = c; t1 = t; } }
    // second team: least played + fewest prior matchups vs t1
    let t2 = null, c2 = Infinity;
    for (const t of teamIds){
      if (t === t1) continue;
      const c = W_PLAY * play[t] + W_OPP * g(t1, t) + Math.random();
      if (c < c2){ c2 = c; t2 = t; }
    }
    play[t1]++; play[t2]++; inc(t1, t2);
    schedule.push({ id: 'm' + (m + 1), teamA: t1, teamB: t2, result: null });
  }
  return schedule;
}
