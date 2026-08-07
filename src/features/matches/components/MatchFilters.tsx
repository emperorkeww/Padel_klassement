import { PERIODE_OPTIES, type Periode } from "../matchFilter";

/**
 * Het periodefilter boven de matchhistorie (#914).
 *
 * De pagina toonde één ongefilterde lijst; bij een actieve club is daar binnen
 * een maand niets meer in terug te vinden. De keuze leeft in de URL, net als
 * elders in de app: deelbaar en refresh-bestendig.
 *
 * Het groepsfilter stond hier tot #1123 als tweede `<select>`. Dat is nu de
 * chipstrook bovenaan de Spelen-hub — twee bedieningen voor dezelfde keuze was
 * precies het probleem dat dat issue oploste. "Wis filters" blijft wél allebei
 * wissen: de groep hoort net zo goed bij wat je ingesteld hebt staan.
 */
export function MatchFilters({
  periode,
  onPeriode,
  onWis,
  /** Staat er buiten de periode nog een filter aan (de groepskeuze)? Bepaalt
   *  samen met de periode of de wis-knop iets te doen heeft. */
  extraFilterActief = false,
}: {
  periode: Periode;
  onPeriode: (p: Periode) => void;
  /** Wist groep én periode tegelijk. Bewust géén twee losse aanroepen: die
   *  lezen elk dezelfde URLSearchParams en zouden elkaars wijziging
   *  overschrijven (zie speelParams.ts). */
  onWis: () => void;
  extraFilterActief?: boolean;
}) {
  const actief = !!periode || extraFilterActief;

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
