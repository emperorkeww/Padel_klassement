/**
 * De stand die een glyph kan tonen. Structureel gelijk aan `AgendaStatus`, maar
 * hier zelfstandig gedefinieerd: dit blad hoort generiek te blijven en niet
 * terug te grijpen op een feature (zie docs/architecture.md §1).
 */
export type GlyphStatus = "booked" | "locked" | "open";

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
 *
 * Sinds #1123 staat hij hier in plaats van bij de agenda: de groepskeuze op de
 * Spelen-hub gebruikt dezelfde vormtaal, en de bijbehorende CSS moest daarvoor
 * mee naar het gedeelde blad (`ui.css`) — `Agenda.css` laadt alleen wanneer de
 * agenda gemount is.
 */
export function StatusGlyph({
  status,
  past = false,
  size = 6,
}: {
  status: GlyphStatus;
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
