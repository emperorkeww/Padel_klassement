import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { DashboardLayout } from "@/app/DashboardLayout";
import { ErrorBoundary } from "@/ui/ErrorBoundary";

// Routes lazy laden zodat elke pagina zijn eigen chunk krijgt.
const LoginScreen = lazy(() => import("@/features/auth/LoginScreen"));
const ResetPassword = lazy(() => import("@/features/auth/ResetPassword"));
const Dashboard = lazy(() => import("@/features/dashboard/Dashboard"));
const Feed = lazy(() => import("@/features/feed/Feed"));
const Leaderboard = lazy(() => import("@/features/standings/Leaderboard"));
const Matches = lazy(() => import("@/features/matches/Matches"));
const Groups = lazy(() => import("@/features/groups/Groups"));
const GroupDetail = lazy(() => import("@/features/groups/GroupDetail"));
const JoinGroup = lazy(() => import("@/features/groups/JoinGroup"));
const Friends = lazy(() => import("@/features/friends/Friends"));
const PlayerProfile = lazy(() => import("@/features/profiles/PlayerProfile"));
const MatchDetail = lazy(() => import("@/features/matches/MatchDetail"));
const ProfileSettings = lazy(() => import("@/features/account/ProfileSettings"));
const Availability = lazy(() => import("@/features/availability/Availability"));

// Dev-showcase (#664): alle FUT-kaartvarianten naast elkaar. Alleen in
// development geregistreerd; de conditionele import houdt de chunk uit de
// productie-build.
const KaartShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/KaartShowcase"))
  : null;

// Dev-showcase (#771): alle varianten van de dashboard player card naast elkaar,
// om dezelfde reden en op dezelfde voorwaarden als de kaart-showcase hierboven.
const HeroShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/dashboard/components/HeroShowcase"))
  : null;

// Dev-stage (#834): de In-Form stormkaart op vaste maat, als vast doelwit van
// scripts/storm-screenshot.sh en de ?debugStorm=1-weergave.
const StormShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/StormShowcase"))
  : null;

function App() {
  const { pathname } = useLocation();
  return (
    // Boundary buiten Suspense (#733), zodat ook een afgewezen lazy-import
    // erin valt. De pathname als resetKey: wegnavigeren van een kapotte route
    // wist de fout. Dekt de routes buiten de shell (login, reset) en een crash
    // in ProtectedRoute/DashboardLayout zelf; binnen de shell vangt de
    // boundary in DashboardLayout de pagina op zónder de navigatie te lossen.
    <ErrorBoundary scope="route" resetKey={pathname}>
      <Suspense fallback={<div className="route-loading">Laden…</div>}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/reset-wachtwoord" element={<ResetPassword />} />

          {/* Beschermde routes delen de dashboard-shell (topbar + navigatie). */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/klassement" element={<Leaderboard />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/banen" element={<Availability />} />
              <Route path="/matches/:id" element={<MatchDetail />} />
              {/* "Spelen" is de hub van de kernreis (#106); de oude
                  groepen-URL blijft werken via een redirect. Die gaat naar
                  ?hub=1 (#761): /groepen betekende "het overzicht", en kaal
                  /spelen stuurt je bij één groep meteen door naar die groep. */}
              <Route path="/spelen" element={<Groups />} />
              <Route
                path="/groepen"
                element={<Navigate to="/spelen?hub=1" replace />}
              />
              <Route path="/groepen/join/:token" element={<JoinGroup />} />
              <Route path="/groepen/:id" element={<GroupDetail />} />
              <Route path="/vrienden" element={<Friends />} />
              <Route path="/spelers/:id" element={<PlayerProfile />} />
              <Route path="/profiel" element={<ProfileSettings />} />
            </Route>
          </Route>

          {KaartShowcase && (
            <Route path="/dev/kaarten" element={<KaartShowcase />} />
          )}
          {HeroShowcase && <Route path="/dev/hero" element={<HeroShowcase />} />}
          {StormShowcase && (
            <Route path="/dev/storm" element={<StormShowcase />} />
          )}

          {/* Onbekende paden terug naar de start. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
