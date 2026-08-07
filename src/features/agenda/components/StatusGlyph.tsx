import type { AgendaStatus } from "../agendaLogic";

/**
 * De statusglyph van een speeldag (#1091, hervormd in #1112).
 *
 * Vorm draagt de status, niet kleur (WCAG 1.4.1): volle stip = geboekt, ring =
 * vastgelegd maar nog te boeken, blokje = open poll, gedempte stip = gespeeld.
 * De status staat daarnaast voluit in de toegankelijke naam van de dagknop, dus
 * deze glyph is puur decoratief.
 *
 * Sinds #1112 zijn de glyphs rond in plaats van vierkant, en heeft de open poll
 * een eigen amber (--poll). De vormen bleven verschillend: het ontwerp gaf drie
 * identieke rondjes die alleen in kleur verschilden, en dat is precies wat 1.4.1
 * verbiedt. Het blokje is bij 6px het enige silhouet dat naast een rondje nog
 * leest — een streepjesrand valt op die maat uit elkaar.
 */
export function StatusGlyph({
  status,
  past = false,
  size = 6,
}: {
  status: AgendaStatus;
  past?: boolean;
  /** Randmaat in px; 6 in een dagcel, 8 in de legenda. */
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
