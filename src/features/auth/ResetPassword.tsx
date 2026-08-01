import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { updateUser } from "./api";
import { useAuth } from "./AuthProvider";
import {
  authErrorMessage,
  authErrorVeld,
  bevestigError,
  passwordError,
  PASSWORD_RULE,
} from "./authErrors";
import { FieldError } from "./FieldError";
import { SterkteBalk } from "./SterkteBalk";
import { BallIcon } from "@/ui/BallIcon";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import "./LoginScreen.css";

type Status = "idle" | "loading" | "error" | "success";
type Veld = "wachtwoord" | "bevestig";

export function ResetPassword() {
  usePageTitle("Nieuw wachtwoord");
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  // Fouten bij het veld waar het misging (#922), net als op het loginscherm.
  const [fouten, setFouten] = useState<Partial<Record<Veld, string>>>({});
  const [capsLock, setCapsLock] = useState(false);
  const velden = useRef<Partial<Record<Veld, HTMLInputElement | null>>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    const nieuwe = {
      wachtwoord: passwordError(password) ?? undefined,
      bevestig: bevestigError(password, confirm) ?? undefined,
    };
    const eersteFout = (["wachtwoord", "bevestig"] as const).find(
      (v) => nieuwe[v],
    );
    if (eersteFout) {
      setFouten(nieuwe);
      setStatus("error");
      velden.current[eersteFout]?.focus();
      return;
    }
    setFouten({});
    setStatus("loading");

    const { error } = await updateUser({ password });
    if (error) {
      setStatus("error");
      const msg = authErrorMessage(error);
      // weak_password/same_password horen bij het wachtwoordveld; de rest
      // (rate limits, onbekend) betreft het hele formulier.
      if (authErrorVeld(error) === "wachtwoord") {
        setFouten({ wachtwoord: msg });
        velden.current.wachtwoord?.focus();
      } else {
        setMessage(msg);
      }
      return;
    }
    setStatus("success");
    setMessage("Wachtwoord gewijzigd — je wordt doorgestuurd.");
    setTimeout(() => navigate("/", { replace: true }), 1200);
  }

  const capsProps = {
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) =>
      setCapsLock(e.getModifierState("CapsLock")),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) =>
      setCapsLock(e.getModifierState("CapsLock")),
    onBlur: () => setCapsLock(false),
  };

  return (
    <div className="login">
      <main className="login-card" role="main">
        <div className="login-brand">
          <BallIcon />
          <span className="login-brand__name">Vamos!</span>
        </div>

        <header className="login-head">
          <h1 className="login-title">Nieuw wachtwoord</h1>
          <p className="login-subtitle">Kies een nieuw wachtwoord voor je account.</p>
        </header>

        {loading ? (
          <p className="login-subtitle">Laden…</p>
        ) : !session ? (
          <>
            <p className="login-message login-message--error" role="status">
              Deze herstellink is ongeldig of verlopen. Vraag een nieuwe aan.
            </p>
            <p className="login-foot">
              <Link className="login-link" to="/login">
                ← Terug naar inloggen
              </Link>
            </p>
          </>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="field">
              <span className="field__label">Nieuw wachtwoord</span>
              <input
                className="field__input"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFouten((f) => ({ ...f, wachtwoord: undefined }));
                }}
                {...capsProps}
                ref={(el) => {
                  velden.current.wachtwoord = el;
                }}
                aria-invalid={fouten.wachtwoord !== undefined}
                aria-describedby={
                  [
                    capsLock ? "caps-lock" : null,
                    "wachtwoord-sterkte",
                    "wachtwoord-regel",
                    fouten.wachtwoord ? "fout-wachtwoord" : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                required
              />
              {capsLock && (
                <span
                  id="caps-lock"
                  className="field__hint field__hint--warn"
                  role="status"
                >
                  ⚠ Caps Lock staat aan.
                </span>
              )}
              <SterkteBalk id="wachtwoord-sterkte" wachtwoord={password} />
              <span id="wachtwoord-regel" className="field__hint">
                {PASSWORD_RULE}
              </span>
              <FieldError id="fout-wachtwoord" text={fouten.wachtwoord} />
            </label>
            <label className="field">
              <span className="field__label">Bevestig wachtwoord</span>
              <input
                className="field__input"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setFouten((f) => ({ ...f, bevestig: undefined }));
                }}
                {...capsProps}
                ref={(el) => {
                  velden.current.bevestig = el;
                }}
                aria-invalid={fouten.bevestig !== undefined}
                aria-describedby={fouten.bevestig ? "fout-bevestig" : undefined}
                required
              />
              <FieldError id="fout-bevestig" text={fouten.bevestig} />
            </label>

            {message && (
              <p className={`login-message login-message--${status}`} role="status">
                {message}
              </p>
            )}

            <button
              className="login-submit"
              type="submit"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Bezig…" : "Wachtwoord opslaan"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

export default ResetPassword;
