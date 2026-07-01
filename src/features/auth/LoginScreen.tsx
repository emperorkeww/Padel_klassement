import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
import "./LoginScreen.css";

type Mode = "signin" | "signup" | "forgot";
type Status = "idle" | "loading" | "error" | "success";

export function LoginScreen() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  // Zodra er een sessie is (net ingelogd of al ingelogd) door naar het dashboard.
  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  function switchMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setMessage("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const cleanEmail = email.trim();

    if (mode === "signup" && password !== confirm) {
      setStatus("error");
      setMessage("De wachtwoorden komen niet overeen.");
      return;
    }

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) return fail(error.message);
      return done("Welkom terug!");
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });
      if (error) return fail(error.message);
      return done("Account aangemaakt — je wordt ingelogd.");
    }

    // mode === "forgot"
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (error) return fail(error.message);
    return done("We hebben je een herstellink gemaild.");
  }

  function fail(msg: string) {
    setStatus("error");
    setMessage(msg);
  }

  function done(msg: string) {
    setStatus("success");
    setMessage(msg);
  }

  async function handleOAuth(provider: "google" | "apple") {
    setStatus("loading");
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) fail(error.message);
  }

  const loading = status === "loading";
  const isForgot = mode === "forgot";
  const isSignup = mode === "signup";

  const submitLabel = loading
    ? "Bezig…"
    : isForgot
      ? "Stuur herstellink"
      : isSignup
        ? "Account aanmaken"
        : "Inloggen";

  return (
    <div className="login">
      <main className="login-card" role="main">
        <div className="login-brand">
          <BallIcon />
          <span className="login-brand__name">Padelclub</span>
        </div>

        <header className="login-head">
          <h1 className="login-title">
            {isForgot
              ? "Wachtwoord herstellen"
              : isSignup
                ? "Maak een account"
                : "Welkom terug"}
          </h1>
          <p className="login-subtitle">
            {isForgot
              ? "Vul je e-mailadres in en we sturen je een herstellink."
              : isSignup
                ? "Word lid en reserveer je eerste baan."
                : "Log in om een baan te reserveren."}
          </p>
        </header>

        {!isForgot && (
          <div className="login-tabs" role="tablist" aria-label="Inloggen of registreren">
            <button
              role="tab"
              aria-selected={mode === "signin"}
              className={`login-tab ${mode === "signin" ? "is-active" : ""}`}
              onClick={() => switchMode("signin")}
              type="button"
            >
              Inloggen
            </button>
            <button
              role="tab"
              aria-selected={mode === "signup"}
              className={`login-tab ${mode === "signup" ? "is-active" : ""}`}
              onClick={() => switchMode("signup")}
              type="button"
            >
              Registreren
            </button>
          </div>
        )}

        {!isForgot && (
          <>
            <div className="login-social">
              <button
                type="button"
                className="social-btn"
                onClick={() => handleOAuth("google")}
                disabled={loading}
              >
                <GoogleIcon />
                Doorgaan met Google
              </button>
              <button
                type="button"
                className="social-btn"
                onClick={() => handleOAuth("apple")}
                disabled={loading}
              >
                <AppleIcon />
                Doorgaan met Apple
              </button>
            </div>
            <div className="login-divider">
              <span>of met e-mail</span>
            </div>
          </>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span className="field__label">E-mailadres</span>
            <input
              className="field__input"
              type="email"
              autoComplete="email"
              placeholder="jij@voorbeeld.nl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          {!isForgot && (
            <label className="field">
              <span className="field__label">Wachtwoord</span>
              <div className="field__wrap">
                <input
                  className="field__input"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="field__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Verberg wachtwoord" : "Toon wachtwoord"}
                >
                  {showPassword ? "Verberg" : "Toon"}
                </button>
              </div>
            </label>
          )}

          {isSignup && (
            <label className="field">
              <span className="field__label">Bevestig wachtwoord</span>
              <input
                className="field__input"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
          )}

          {mode === "signin" && (
            <div className="login-row">
              <button
                type="button"
                className="login-link"
                onClick={() => switchMode("forgot")}
              >
                Wachtwoord vergeten?
              </button>
            </div>
          )}

          {message && (
            <p className={`login-message login-message--${status}`} role="status">
              {message}
            </p>
          )}

          <button className="login-submit" type="submit" disabled={loading}>
            {submitLabel}
          </button>
        </form>

        <footer className="login-foot">
          {isForgot ? (
            <button
              type="button"
              className="login-link"
              onClick={() => switchMode("signin")}
            >
              ← Terug naar inloggen
            </button>
          ) : isSignup ? (
            <>
              Al lid?{" "}
              <button
                type="button"
                className="login-link"
                onClick={() => switchMode("signin")}
              >
                Inloggen
              </button>
            </>
          ) : (
            <>
              Nog geen lid?{" "}
              <button
                type="button"
                className="login-link"
                onClick={() => switchMode("signup")}
              >
                Word clublid
              </button>
            </>
          )}
        </footer>
      </main>
    </div>
  );
}

/* ---------- Inline iconen (klein & neutraal) ---------- */

function BallIcon() {
  return (
    <svg
      className="login-brand__ball"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="#c7e63a" />
      <path
        d="M4 8.5c4 1.5 12 1.5 16 0M4 15.5c4-1.5 12-1.5 16 0"
        stroke="#fff"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3 0-5.6-2-6.5-4.8H1.5v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.5 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.5a12 12 0 0 0 0 10.8l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.5 6.7l4 3.1C6.4 6.8 9 4.8 12 4.8z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="#000">
      <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.7 0-1.9-.8-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2-.1 1.6-.8 3-.8 1.4 0 1.8.8 3 .7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.7zM14.1 5.8c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z" />
    </svg>
  );
}

export default LoginScreen;
