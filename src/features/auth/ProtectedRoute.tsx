import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { getProfile } from "@/features/profiles/api";

/**
 * Beschermt routes: zonder sessie stuur je door naar /login.
 * Tijdens het laden van de sessie tonen we een korte laadstaat om te
 * voorkomen dat een ingelogde gebruiker even naar /login flitst.
 * De oorspronkelijke bestemming gaat mee, zodat je na het inloggen op de
 * gevraagde pagina belandt (bv. een gedeelde groepsuitnodiging).
 *
 * Sinds #1036 hangt hier ook de gedwongen wachtwoordwissel aan: kreeg iemand een
 * tijdelijk wachtwoord van een beheerder, dan komt hij niet verder dan
 * /reset-wachtwoord tot hij zelf een nieuw wachtwoord kiest.
 */
export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const myId = session?.user?.id ?? "";

  // Kost géén extra netwerkverkeer: getProfile cachet onder `profiles:one:<id>`
  // en DashboardLayout haalt datzelfde profiel toch al op. Dit schuift die ene
  // query alleen naar voren.
  const profile = useAsync(
    () => (myId ? getProfile(myId) : Promise.resolve(null)),
    [myId],
  );

  if (loading) {
    return <div className="route-loading">Laden…</div>;
  }

  if (!session) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  // Bewust niet blokkeren zolang het profiel nog laadt, en bewust fail-open bij
  // een fout: dit is een ergonomische poort en geen beveiligingsgrens. Die grens
  // is dat een tijdelijk wachtwoord verder niets extra's mag. Zou dit wél
  // blokkeren, dan betaalt iedereen bij elke koude start voor een geval dat
  // vrijwel nooit voorkomt.
  if (profile.data?.moet_wachtwoord_wijzigen) {
    // /reset-wachtwoord staat buiten deze route, dus een lus is onmogelijk:
    // zodra je daar bent, is ProtectedRoute niet meer gemonteerd.
    return <Navigate to="/reset-wachtwoord?verplicht=1" replace />;
  }

  return <Outlet />;
}
