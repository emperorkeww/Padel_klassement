import { useAuth } from "../features/auth/AuthProvider";
import "./Dashboard.css";

export function Dashboard() {
  const { user, signOut } = useAuth();

  return (
    <div className="dashboard">
      <header className="dashboard__bar">
        <div className="dashboard__brand">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="#c7e63a" />
            <path
              d="M4 8.5c4 1.5 12 1.5 16 0M4 15.5c4-1.5 12-1.5 16 0"
              stroke="#fff"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <span>Padelclub</span>
        </div>
        <button className="dashboard__signout" onClick={() => signOut()}>
          Uitloggen
        </button>
      </header>

      <main className="dashboard__main">
        <h1 className="dashboard__title">
          Welkom{user?.email ? `, ${user.email}` : ""}!
        </h1>
        <p className="dashboard__subtitle">
          Je bent ingelogd. Hier komt straks je baanoverzicht en reserveringen.
        </p>
      </main>
    </div>
  );
}

export default Dashboard;
