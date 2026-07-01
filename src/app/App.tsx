import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { DashboardLayout } from "../components/DashboardLayout";

// Routes lazy laden zodat elke pagina zijn eigen chunk krijgt.
const LoginScreen = lazy(() => import("../features/auth/LoginScreen"));
const Dashboard = lazy(() => import("../features/dashboard/Dashboard"));
const Leaderboard = lazy(() => import("../features/standings/Leaderboard"));
const Matches = lazy(() => import("../features/matches/Matches"));
const Groups = lazy(() => import("../features/groups/Groups"));
const GroupDetail = lazy(() => import("../features/groups/GroupDetail"));
const Friends = lazy(() => import("../features/friends/Friends"));
const PlayerProfile = lazy(() => import("../features/profiles/PlayerProfile"));
const MatchDetail = lazy(() => import("../features/matches/MatchDetail"));
const ProfileSettings = lazy(() => import("../features/account/ProfileSettings"));

function App() {
  return (
    <Suspense fallback={<div className="route-loading">Laden…</div>}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />

        {/* Beschermde routes delen de dashboard-shell (topbar + navigatie). */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/klassement" element={<Leaderboard />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/matches/:id" element={<MatchDetail />} />
            <Route path="/groepen" element={<Groups />} />
            <Route path="/groepen/:id" element={<GroupDetail />} />
            <Route path="/vrienden" element={<Friends />} />
            <Route path="/spelers/:id" element={<PlayerProfile />} />
            <Route path="/profiel" element={<ProfileSettings />} />
          </Route>
        </Route>

        {/* Onbekende paden terug naar de start. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
