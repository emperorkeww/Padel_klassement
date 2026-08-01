import { PERIODE_OPTIES, type Periode } from "../matchFilter";
import type { GroupSummary } from "@/features/groups/api";

/**
 * Groep- en periodefilter boven de matchhistorie (#914).
 *
 * De pagina toonde één ongefilterde lijst; bij een actieve club is daar binnen
 * een maand niets meer in terug te vinden. De keuze leeft in de URL, net als
 * elders in de app: deelbaar en refresh-bestendig.
 */
export function MatchFilters({
  groups,
  groupId,
  onGroup,
  periode,
  onPeriode,
  onWis,
}: {
  groups: GroupSummary[];
  groupId: string;
  onGroup: (id: string) => void;
  periode: Periode;
  onPeriode: (p: Periode) => void;
  /** Beide tegelijk wissen. Bewust géén twee losse aanroepen: die lezen elk
   *  dezelfde URLSearchParams en zouden elkaars wijziging overschrijven. */
  onWis: () => void;
}) {
  const actief = !!groupId || !!periode;

  return (
    <div className="match-filters" role="group" aria-label="Matches filteren">
      {/* Zonder groepen valt er niets te kiezen; dan alleen de periode. */}
      {groups.length > 0 && (
        <label className="match-filters__field">
          <span>Groep</span>
          <select
            className="select select--filter"
            aria-label="Groep"
            value={groupId}
            onChange={(e) => onGroup(e.target.value)}
          >
            <option value="">Alle groepen</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="match-filters__field">
        <span>Periode</span>
        <select
          className="select select--filter"
          aria-label="Periode"
          value={periode}
          onChange={(e) => onPeriode(e.target.value as Periode)}
        >
          {PERIODE_OPTIES.map(([k, label]) => (
            <option key={k || "alles"} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {actief && (
        <button
          type="button"
          className="btn btn--sm match-filters__wis"
          onClick={onWis}
        >
          <span aria-hidden="true">✕</span> Wis filters
        </button>
      )}
    </div>
  );
}

export default MatchFilters;
