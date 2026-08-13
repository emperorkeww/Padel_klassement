import { PERIODE_OPTIES, type Periode } from "../matchFilter";

/**
 * De filters boven de matchhistorie (#914).
 *
 * De keuzes leven in de URL, net als elders in de app: deelbaar en
 * refresh-bestendig.
 *
 * Het groepsfilter stond hier tot #1123 al eens als `<select>`. Dat issue haalde
 * het weg omdat de chipstrook bovenaan de hub dezelfde keuze maakte — twee
 * bedieningen voor één ding. #1134 draait dat gedeeltelijk terug, met een ander
 * onderscheid: het waren nooit dezelfde keuze. Een groep aantikken is
 * *navigeren* (je gaat de groep in), een groep filteren is *filteren* (de
 * historie eronder krimpt). De groepskaarten doen straks het eerste, dit filter
 * het tweede — en dan is er weer precies één bediening per rol.
 */
export function MatchFilters({
  periode,
  onPeriode,
  groep,
  onGroep,
  groepen,
  onWis,
}: {
  periode: Periode;
  onPeriode: (p: Periode) => void;
  /** Gekozen groep-id, "" = alle groepen. */
  groep: string;
  onGroep: (id: string) => void;
  /** Waar je uit kunt kiezen; komt van de pagina, die de groepen toch al laadt.
   *  Leeg = geen groepen, dan heeft het filter niets te kiezen en verschijnt het
   *  ook niet. */
  groepen: { id: string; name: string }[];
  /** Wist groep én periode tegelijk. Bewust géén twee losse aanroepen: die
   *  lezen elk dezelfde URLSearchParams en zouden elkaars wijziging
   *  overschrijven (zie speelParams.ts). */
  onWis: () => void;
}) {
  // Alleen wissen wat op déze pagina te wissen valt (#1298). Op de groepspagina
  // is `groep` het route-id: altijd gevuld, maar niet door een filter gezet en
  // dus ook niet door `onWis` te verwijderen. De knop stond daar permanent en
  // deed bij een klik niets — de URL was er ná de klik identiek.
  const actief = !!periode || (groepen.length > 0 && !!groep);

  return (
    <div className="match-filters" role="group" aria-label="Matches filteren">
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

      {groepen.length > 0 && (
        <label className="match-filters__field">
          <span>Groep</span>
          <select
            className="select select--filter"
            aria-label="Groep"
            value={groep}
            onChange={(e) => onGroep(e.target.value)}
          >
            {/* "" en niet "alle": de afwezigheid van een groep is geen waarde
                die je in de URL schrijft (zie speelParams.ts). */}
            <option value="">Alle groepen</option>
            {groepen.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}

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
