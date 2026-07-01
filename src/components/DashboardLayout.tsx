import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { BallIcon } from "./BallIcon";
import "./ui.css";
import "./DashboardLayout.css";

const NAV = [
  { to: "/", label: "Overzicht", end: true },
  { to: "/klassement", label: "Klassement" },
  { to: "/matches", label: "Matches" },
  { to: "/groepen", label: "Groepen" },
  { to: "/vrienden", label: "Vrienden" },
];

export function DashboardLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="shell">
      <header className="shell__bar">
        <Link to="/" className="shell__brand" aria-label="Naar overzicht">
          <BallIcon />
          <span>Padelclub</span>
        </Link>

        <nav className="shell__nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shell__link ${isActive ? "is-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="shell__account">
          <span className="shell__email">{user?.email}</span>
          <button className="shell__signout" onClick={() => signOut()}>
            Uitloggen
          </button>
        </div>
      </header>

      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;
