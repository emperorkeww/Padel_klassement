import { Link, useLocation } from "react-router-dom";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

/**
 * Echte 404 (#910, raakt #189).
 *
 * Een onbekend pad werd stil naar het overzicht geredirect: een typefout of een
 * dode link uit een oud bericht landde dan zonder uitleg op een pagina die je
 * niet vroeg. Deze staat vertelt wat er aan de hand is en biedt twee wegen
 * terug. Hij leeft binnen de shell, dus de navigatie blijft gewoon staan.
 */
export function NotFound() {
  const { pathname } = useLocation();
  usePageTitle("Pagina niet gevonden");

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Pagina niet gevonden</h1>
      </header>

      <div className="card">
        <EmptyState
          icon="🎾"
          title="Deze bal ging buiten de lijnen."
          action={
            /* Bewust niet "Naar overzicht": dat is al de toegankelijke naam van
               de merklink in de zijbalk. De weg terug naar waar je vandaan kwam
               staat sinds #1299 in de shell — dit scherm zette daar zijn eigen
               knop naast en dat waren er twee. */
            <Link className="btn btn--primary" to="/">
              Naar het overzicht
            </Link>
          }
        >
          Er staat niets op <code>{pathname}</code>. Misschien is de link oud of
          zit er een typefout in het adres.
        </EmptyState>
      </div>
    </div>
  );
}

export default NotFound;
