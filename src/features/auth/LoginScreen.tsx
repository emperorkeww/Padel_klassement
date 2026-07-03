import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
import { BallIcon } from "../../components/BallIcon";
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
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
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
        options: {
          data: {
            full_name: fullName.trim() || undefined,
            username: username.trim() || undefined,
          },
        },
      });
      if (error) return fail(error.message);
      return done("Account aangemaakt — je wordt ingelogd.");
    }

    // mode === "forgot"
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-wachtwoord`,
    });
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
          <span className="login-brand__name">Vamos!</span>
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

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <>
              <label className="field">
                <span className="field__label">Naam</span>
                <input
                  className="field__input"
                  type="text"
                  autoComplete="name"
                  placeholder="Voor- en achternaam"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Gebruikersnaam</span>
                <input
                  className="field__input"
                  type="text"
                  autoComplete="username"
                  placeholder="bijv. remco (optioneel)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
            </>
          )}

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
                Word lid
              </button>
            </>
          )}
        </footer>
      </main>
    </div>
  );
}

export default LoginScreen;
