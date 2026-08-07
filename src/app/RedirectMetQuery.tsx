import { Navigate, useLocation } from "react-router-dom";

/**
 * Redirect die de querystring en het anker meeneemt (#1123).
 *
 * `<Navigate to="/spelen" replace />` gooit alles achter het pad weg: een
 * gedeelde link als `/matches?groep=g1&periode=7d` landde dan op een kale
 * pagina zonder dat iets verried dat de filters onderweg zijn kwijtgeraakt.
 * Vandaar het `To`-object met `search` en `hash` uit de huidige locatie.
 */
export function RedirectMetQuery({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}

export default RedirectMetQuery;
