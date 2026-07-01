import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";

/**
 * Beschermt routes: zonder sessie stuur je door naar /login.
 * Tijdens het laden van de sessie tonen we een korte laadstaat om te
 * voorkomen dat een ingelogde gebruiker even naar /login flitst.
 */
export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="route-loading">Laden…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
