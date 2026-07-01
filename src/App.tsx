import { Routes, Route, Navigate } from "react-router-dom";
import LoginScreen from "./features/auth/LoginScreen";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />

      {/* Beschermde routes: alleen bereikbaar met een sessie. */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
      </Route>

      {/* Onbekende paden terug naar de start. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
