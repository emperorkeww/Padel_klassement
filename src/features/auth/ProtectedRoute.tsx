import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

/**
 * Beschermt routes: zonder sessie stuur je door naar /login.
 * Tijdens het laden van de sessie tonen we een korte laadstaat om te
 * voorkomen dat een ingelogde gebruiker even naar /login flitst.
 * De oorspronkelijke bestemming gaat mee, zodat je na het inloggen op de
 * gevraagde pagina belandt (bv. een gedeelde groepsuitnodiging).
 */
export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="route-loading">Laden…</div>;
  }

  if (!session) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}
