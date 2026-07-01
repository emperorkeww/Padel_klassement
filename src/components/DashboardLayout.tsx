import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { BallIcon } from "./BallIcon";
import "./ui.css";
import "./DashboardLayout.css";

const NAV: { to: string; label: string; end?: boolean; icon: ReactNode }[] = [
  { to: "/", label: "Overzicht", end: true, icon: <IconHome /> },
  { to: "/klassement", label: "Klassement", icon: <IconTrophy /> },
  { to: "/matches", label: "Matches", icon: <IconRacket /> },
  { to: "/banen", label: "Banen", icon: <IconCourt /> },
  { to: "/groepen", label: "Groepen", icon: <IconUsers /> },
  { to: "/vrienden", label: "Vrienden", icon: <IconUserPlus /> },
  { to: "/profiel", label: "Profiel", icon: <IconUser /> },
];

export function DashboardLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="sidebar__brand" aria-label="Naar overzicht">
          <BallIcon size={26} />
          <span>Vamos!</span>
        </Link>

        <nav className="sidebar__nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? "is-active" : ""}`
              }
            >
              <span className="sidebar__icon">{item.icon}</span>
              <span className="sidebar__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <span className="sidebar__email" title={user?.email ?? ""}>
            {user?.email}
          </span>
          <button className="sidebar__signout" onClick={() => signOut()}>
            Uitloggen
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="content__inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* ---- Iconen (line-stijl, currentColor) ---- */
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4h12v4a6 6 0 0 1-12 0V4Z" />
      <path d="M6 6H3v1a3 3 0 0 0 3 3M18 6h3v1a3 3 0 0 1-3 3" />
      <path d="M9 20h6M12 14v6" />
    </svg>
  );
}
function IconRacket() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9.5" cy="9.5" r="6" />
      <path d="M5.3 13.7 3 21M9.5 5.5v8M5.5 9.5h8" />
    </svg>
  );
}
function IconCourt() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M12 5v14M3 12h18M7 9.5v5M17 9.5v5" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.5M17 20a6 6 0 0 0-3-5.2" />
    </svg>
  );
}
function IconUserPlus() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 11 0" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export default DashboardLayout;
