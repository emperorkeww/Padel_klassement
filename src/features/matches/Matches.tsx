import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { MatchesSectie } from "./MatchesSectie";
import { useSpeelParams } from "./speelParams";

/**
 * De Matches-pagina: kop plus de matchsectie (#1123).
 *
 * De inhoud zelf staat in `MatchesSectie`, zodat hij straks ook onder de
 * groepskeuze op de Spelen-hub past. Wat hier blijft, is wat bij een página
 * hoort: de tabtitel, de kop en het eigenaarschap over de querystring.
 */
export function Matches() {
  usePageTitle("Matches");
  const params = useSpeelParams();

  return (
    // De ruimte voor de zwevende knop hoort op de pagina-root: op de sectie
    // zelf zou de padding halverwege de pagina landen en ligt de knop alsnog
    // over wat eronder staat.
    <div className="heeft-zwevende-actie">
      <header className="page-head">
        <h1 className="page-title">Matches</h1>
        <p className="page-subtitle">
          Alle veldslagen uit het verleden en de toekomst op één plek.
        </p>
      </header>

      <MatchesSectie
        groepId={params.groep}
        periode={params.periode}
        onGroep={params.zetGroep}
        onPeriode={params.zetPeriode}
        onWisFilters={params.wisFilters}
        logDirect={params.logDirect}
        onLogVerbruikt={params.verbruikLog}
      />
    </div>
  );
}

export default Matches;
