import type { AgendaStatus } from "../agendaLogic";

/**
 * De statusglyph van een speeldag (#1091).
 *
 * Vorm draagt de status, niet kleur (WCAG 1.4.1): vol vierkant = geboekt, open
 * vierkant = vastgelegd maar nog te boeken, gestreept = open poll, gedempt vol
 * = gespeeld. De status staat daarnaast voluit in de toegankelijke naam van de
 * dagknop, dus deze glyph is puur decoratief.
 */
export function StatusGlyph({
  status,
  past = false,
  size = 8,
}: {
  status: AgendaStatus;
  past?: boolean;
  /** Randmaat in px; 8 in een dagcel, 9 in de legenda, 10 op desktop. */
  size?: number;
}) {
  return (
    <span
      className={`agenda-glyph agenda-glyph--${past ? "past" : status}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export default StatusGlyph;
