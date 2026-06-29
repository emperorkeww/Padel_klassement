/* =========================================================================
   RESULT LOGIC
   Turns raw set scores into a match result. Pure: no DOM, no shared state.
   ========================================================================= */

const PTS_WIN = 3, PTS_DRAW = 1, PTS_LOSS = 0;

/* sets/tb are [gamesA, gamesB]; tb may be null. Returns result or {error}. */
function computeResult(s1, s2, tb){
  const valid = s => Array.isArray(s) && Number.isInteger(s[0]) && Number.isInteger(s[1]) && s[0] >= 0 && s[1] >= 0;
  if (!valid(s1) || !valid(s2)) return { error: 'Enter both set scores.' };
  if (s1[0] === s1[1]) return { error: 'Set 1 can’t be a tie.' };
  if (s2[0] === s2[1]) return { error: 'Set 2 can’t be a tie.' };

  let setsA = 0, setsB = 0;
  s1[0] > s1[1] ? setsA++ : setsB++;
  s2[0] > s2[1] ? setsA++ : setsB++;

  const gamesA = s1[0] + s2[0];
  const gamesB = s1[1] + s2[1];

  let winner, keptTb = null;
  if (setsA === 2) winner = 'A';
  else if (setsB === 2) winner = 'B';
  else { // 1–1: decided by match tiebreak, else a draw
    if (tb && Number.isInteger(tb[0]) && Number.isInteger(tb[1]) && (tb[0] !== tb[1])){
      winner = tb[0] > tb[1] ? 'A' : 'B';
      keptTb = tb;            // only meaningful when sets are split
    } else {
      winner = 'draw';
    }
  }
  return { s1, s2, tb: keptTb, winner, gamesA, gamesB };
}
