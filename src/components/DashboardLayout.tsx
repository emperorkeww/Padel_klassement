import { Suspense, type ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { useAsync } from "../lib/useAsync";
import { getProfile, displayName } from "../features/profiles/api";
import { Avatar } from "./Avatar";
import { BallIcon } from "./BallIcon";
import "./ui.css";
import "./DashboardLayout.css";

type NavItem = { to: string; label: string; end?: boolean; icon: ReactNode };

// Taakgerichte navigatie (#106): vier taken i.p.v. zeven datatabellen.
// Matches en Banen blijven als routes bestaan (bereikbaar bínnen de flow);
// de zijbalk toont ze als secundaire items, de mobiele balk niet meer (#69:
// Ik/Vrienden zijn nu wél direct bereikbaar).
const OVERZICHT: NavItem = { to: "/", label: "Overzicht", end: true, icon: <BallIcon size={22} /> };
const SPELEN: NavItem = { to: "/spelen", label: "Spelen", icon: <IconRacket /> };
const KLASSEMENT: NavItem = { to: "/klassement", label: "Klassement", icon: <IconTrophy /> };
const IK: NavItem = { to: "/profiel", label: "Ik", icon: <IconUser /> };
const MATCHES: NavItem = { to: "/matches", label: "Matcharchief", icon: <IconUsers /> };
const BANEN: NavItem = { to: "/banen", label: "Banen", icon: <IconCourt /> };
const VRIENDEN: NavItem = { to: "/vrienden", label: "Vrienden", icon: <IconUserPlus /> };

// Desktop: gegroepeerde zijbalk, met de secundaire routes erbij.
const SIDEBAR_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Spelen", items: [OVERZICHT, SPELEN, MATCHES, BANEN] },
  { title: "Competitie", items: [KLASSEMENT] },
  { title: "Ik", items: [VRIENDEN, IK] },
];

// Mobiel: vijf tabs, symmetrisch rond de uitstekende padelbal in het midden
// (2 links · bal · 2 rechts). Vrienden is daarmee ook één tik bereikbaar (#69).
const TABBAR: NavItem[] = [SPELEN, KLASSEMENT, OVERZICHT, VRIENDEN, IK];

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const myId = user?.id ?? "";
  // Eigen profiel voor de avatar in topbalk en zijbalk-voet; de layout blijft
  // gemount tijdens navigatie, dus dit is één query per sessie.
  const profile = useAsync(
    () => (myId ? getProfile(myId) : Promise.resolve(null)),
    [myId],
  );
  const me = profile.data ?? null;

  return (
    <div className="shell">
      {/* Eerste tab-stop: sla de navigatie over, spring naar de inhoud. */}
      <a href="#content" className="skip-link">
        Naar inhoud
      </a>
      {/* Mobiele topbalk: merk links, eigen avatar (naar profiel) rechts. */}
      <header className="topbar">
        <Link to="/" className="topbar__brand" aria-label="Naar overzicht">
          <BallIcon size={22} />
          <span>Vamos!</span>
        </Link>
        <Link to="/profiel" className="topbar__profile" aria-label="Naar profiel">
          <Avatar profile={me} name={me ? undefined : (user?.email ?? "?")} size={32} />
        </Link>
      </header>

      {/* Desktop-zijbalk met gegroepeerde navigatie. */}
      <aside className="sidebar">
        <Link to="/" className="sidebar__brand" aria-label="Naar overzicht">
          <BallIcon size={26} />
          <span>Vamos!</span>
        </Link>

        <nav className="sidebar__nav" aria-label="Hoofdnavigatie">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.title} className="sidebar__group">
              <span className="sidebar__group-title">{group.title}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  viewTransition
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? "is-active" : ""}`
                  }
                >
                  <span className="sidebar__icon">{item.icon}</span>
                  <span className="sidebar__label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <Link to="/profiel" className="sidebar__user">
            <Avatar profile={me} name={me ? undefined : (user?.email ?? "?")} size={36} />
            <span className="sidebar__user-text">
              <span className="sidebar__user-name">
                {me ? displayName(me) : (user?.email ?? "")}
              </span>
              <span className="sidebar__user-mail" title={user?.email ?? ""}>
                {user?.email}
              </span>
            </span>
          </Link>
          <button className="sidebar__signout" onClick={() => signOut()}>
            Uitloggen
          </button>
        </div>
      </aside>

      <main className="content" id="content" tabIndex={-1}>
        <div className="content__inner">
          {/* Suspense hier (i.p.v. rond alle routes) houdt de balken gemount
              tijdens het lazy-laden van een pagina — zo springt de navigatie
              op mobiel niet weg. Een neutrale, tekstloze skeleton voorkomt de
              sprong van "Laden…" naar de pagina-eigen skeletons. */}
          <Suspense
            fallback={
              <div className="route-skeleton" aria-hidden="true">
                <div className="route-skeleton__bar route-skeleton__bar--title" />
                <div className="route-skeleton__bar route-skeleton__bar--sub" />
                <div className="route-skeleton__card" />
                <div className="route-skeleton__card" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Mobiele onderbalk: vijf tabs met labels, bal in het midden. */}
      <nav className="tabbar" aria-label="Hoofdnavigatie">
        {TABBAR.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            viewTransition
            aria-label={item.label}
            className={({ isActive }) =>
              `tabbar__link ${item.end ? "tabbar__link--home" : ""} ${isActive ? "is-active" : ""}`
            }
          >
            <span className="tabbar__icon">{item.icon}</span>
            <span className="tabbar__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/* ---- Iconen (line-stijl, currentColor) ---- */
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
