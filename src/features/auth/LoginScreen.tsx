import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  signInWithPassword,
  signUp,
  resetPasswordForEmail,
  findProfileByUsername,
} from "./api";
import { useAuth } from "./AuthProvider";
import { BallIcon } from "@/ui/BallIcon";
import "./LoginScreen.css";

type Mode = "signin" | "signup" | "forgot";
type Status = "idle" | "loading" | "error" | "success";

export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  // Bestemming van vóór de redirect (bv. een gedeelde uitnodigingslink).
  const returnTo =
    (location.state as { from?: string } | null)?.from || "/";
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
  // Live beschikbaarheid van de gekozen gebruikersnaam bij registreren.
  const [nameStatus, setNameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const nameSeq = useRef(0);

  // Zodra er een sessie is (net ingelogd of al ingelogd) door naar de
  // oorspronkelijke bestemming (of het dashboard).
  useEffect(() => {
    if (session) navigate(returnTo, { replace: true });
  }, [session, navigate, returnTo]);

  function switchMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setMessage("");
  }

  // Controleert (met debounce) of de gebruikersnaam nog vrij is. Profielen zijn
  // publiek leesbaar, dus dit werkt ook vóór het inloggen.
  useEffect(() => {
    if (mode !== "signup") {
      setNameStatus("idle");
      return;
    }
    const u = username.trim();
    if (u.length < 3) {
      setNameStatus("idle");
      return;
    }
    const seq = ++nameSeq.current;
    setNameStatus("checking");
    const t = setTimeout(async () => {
      const { data, error } = await findProfileByUsername(u);
      if (seq !== nameSeq.current) return;
      if (error) return setNameStatus("idle");
      setNameStatus(data && data.length > 0 ? "taken" : "available");
    }, 400);
    return () => clearTimeout(t);
  }, [username, mode]);

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
      const { error } = await signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) return fail(error.message);
      return done("Welkom terug!");
    }

    if (mode === "signup") {
      const { data, error } = await signUp({
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
      // Met e-mailbevestiging aan levert signUp géén sessie op: de speler moet
      // eerst de link in de bevestigingsmail openen. Alleen bij een directe
      // sessie klopt "je wordt ingelogd" (de redirect-useEffect vuurt dan).
      if (data.session) {
        return done("Account aangemaakt — je wordt ingelogd.");
      }
      return done(
        `Bijna klaar! We hebben je een bevestigingsmail gestuurd op ${cleanEmail}. ` +
          "Open de link in die mail om je account te activeren en in te loggen " +
          "(lokaal: Mailpit).",
      );
    }

    // mode === "forgot"
    const { error } = await resetPasswordForEmail(cleanEmail, {
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
                  aria-describedby="username-availability"
                />
                {nameStatus !== "idle" && (
                  <span
                    id="username-availability"
                    className={`field__hint field__hint--${nameStatus}`}
                    role="status"
                  >
                    {nameStatus === "checking"
                      ? "Beschikbaarheid controleren…"
                      : nameStatus === "available"
                        ? "✓ Deze gebruikersnaam is vrij."
                        : "Die naam is bezet — we maken er automatisch iets unieks van."}
                  </span>
                )}
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
