import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";

// Routes lazy laden zodat de login- en dashboardcode in aparte chunks komen.
const LoginScreen = lazy(() => import("./features/auth/LoginScreen"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

function App() {
  return (
    <Suspense fallback={<div className="route-loading">Laden…</div>}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />

        {/* Beschermde routes: alleen bereikbaar met een sessie. */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
        </Route>

        {/* Onbekende paden terug naar de start. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
