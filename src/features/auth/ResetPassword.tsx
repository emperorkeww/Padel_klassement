import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
import { BallIcon } from "../../components/BallIcon";
import "./LoginScreen.css";

type Status = "idle" | "loading" | "error" | "success";

export function ResetPassword() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (password.length < 6) {
      setStatus("error");
      setMessage("Wachtwoord: minstens 6 tekens.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setMessage("De wachtwoorden komen niet overeen.");
      return;
    }
    setStatus("loading");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("success");
    setMessage("Wachtwoord gewijzigd — je wordt doorgestuurd.");
    setTimeout(() => navigate("/", { replace: true }), 1200);
  }

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
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Bevestig wachtwoord</span>
              <input
                className="field__input"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
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
