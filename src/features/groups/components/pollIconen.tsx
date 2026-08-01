import type { OptionState } from "@/features/groups/pollLogic";

// Iconen van de stemrij (#946).
//
// Status en actie droegen allebei een ✓: rechtsboven een rond omlijnd vinkje
// voor de haalbaarheid, en in de knoppengroep ernaast nóg een vinkje om te
// stemmen. Je kon niet zien wat je moest aflezen en wat je kon aantikken.
//
// Daarom twee taalregisters. De haalbaarheid is een meter — een ring die vol,
// half of leeg staat — en de stemknoppen dragen een vinkje en een kruis. Geen
// enkel teken komt in allebei voor. Ze zijn bovendien getekend en niet
// getypt: ✓ en ✗ vielen per platform anders uit (in de doorloop verscheen ✓
// als het wortelteken √ en ✗ als een hoofdletter X).

/** Hoeveel van de ring gevuld is per haalbaarheid; null = onbekend. */
const VULLING: Record<OptionState, number | null> = {
  haalbaar: 1,
  krap: 0.5,
  onhaalbaar: 0,
  onbekend: null,
};

/**
 * De haalbaarheid als meter: een ring die vol (haalbaar), half (krap) of leeg
 * (onhaalbaar) staat, en gestippeld bij onbekend. De betekenis staat in de
 * `aria-label` van de knop eromheen — dit is de tekening, niet de tekst.
 */
export function PollStateIcon({ state }: { state: OptionState }) {
  const vulling = VULLING[state];
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      aria-hidden="true"
      className="poll-state-icon"
    >
      <circle
        cx="10"
        cy="10"
        r="7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={vulling == null ? "3 3" : undefined}
      />
      {vulling === 1 && <circle cx="10" cy="10" r="4.5" fill="currentColor" />}
      {vulling === 0.5 && (
        // Halve maan: dezelfde schijf, links afgesneden.
        <path d="M10 5.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" />
      )}
    </svg>
  );
}

/** Vinkje van de stemknop "Ik kan". */
export function PollJaIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

/** Kruis van de stemknop "Kan niet". */
export function PollNeeIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}
