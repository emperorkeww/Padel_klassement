// Subtiele trilfeedback bij acties op de baan. Alleen toestellen met de
// Vibration API (Android) trillen; iOS en desktop doen stil niets.

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* geen ondersteuning of geen toestemming — geen probleem */
  }
}

/** Korte tik: score opgeslagen, actie bevestigd. */
export function tap() {
  vibrate(10);
}

/** Dubbele puls: eigen winst — hoort bij de confetti. */
export function winPulse() {
  vibrate([10, 40, 20]);
}
