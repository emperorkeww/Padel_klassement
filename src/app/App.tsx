import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { DashboardLayout } from "./components/DashboardLayout";

// Routes lazy laden zodat elke pagina zijn eigen chunk krijgt.
const LoginScreen = lazy(() => import("./features/auth/LoginScreen"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Matches = lazy(() => import("./pages/Matches"));
const Groups = lazy(() => import("./pages/Groups"));
const GroupDetail = lazy(() => import("./pages/GroupDetail"));
const Friends = lazy(() => import("./pages/Friends"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const MatchDetail = lazy(() => import("./pages/MatchDetail"));

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
          </Route>
        </Route>

        {/* Onbekende paden terug naar de start. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
