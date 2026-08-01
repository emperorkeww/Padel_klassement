import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  signInWithPassword,
  signUp,
  resetPasswordForEmail,
  findProfileByUsername,
} from "./api";
import { useAuth } from "./AuthProvider";
import {
  authErrorMessage,
  authErrorVeld,
  bevestigError,
  emailError,
  passwordError,
  PASSWORD_RULE,
  type AuthVeld,
} from "./authErrors";
import { FieldError } from "./FieldError";
import { SterkteBalk } from "./SterkteBalk";
import { BallIcon } from "@/ui/BallIcon";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import "./LoginScreen.css";

type Mode = "signin" | "signup" | "forgot";
type Status = "idle" | "loading" | "error" | "success";
type Fouten = Partial<Record<AuthVeld, string>>;

// Tabtitel per modus (#910): het scherm wisselt van taak zonder van route te
// wisselen, dus de titel volgt de modus in plaats van het pad.
const TITEL_PER_MODUS: Record<Mode, string> = {
  signin: "Inloggen",
  signup: "Account maken",
  forgot: "Wachtwoord vergeten",
};

// Welke velden telt een modus mee bij het versturen (#922).
const VELDEN_PER_MODUS: Record<Mode, AuthVeld[]> = {
  signin: ["email", "wachtwoord"],
  signup: ["gebruikersnaam", "email", "wachtwoord", "bevestig"],
  forgot: ["email"],
};

const BEZET =
  "Die gebruikersnaam is al bezet. Kies een andere, of laat het veld leeg.";

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
  // Foutmeldingen bij het veld waar het misging (#922). Een lege string betekent
  // "wel verdacht, maar de melding staat elders" — zie invalid_credentials.
  const [fouten, setFouten] = useState<Fouten>({});
  const [capsLock, setCapsLock] = useState(false);
  // Gezet zodra signUp gelukt is zonder sessie: dan is de mailbox de volgende
  // stap en heeft het formulier niets meer te vragen.
  const [mailNaar, setMailNaar] = useState<string | null>(null);
  // Live beschikbaarheid van de gekozen gebruikersnaam bij registreren.
  const [nameStatus, setNameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const nameSeq = useRef(0);
  const velden = useRef<Partial<Record<AuthVeld, HTMLInputElement | null>>>({});

  usePageTitle(mailNaar ? "Check je mail" : TITEL_PER_MODUS[mode]);

  const loading = status === "loading";
  const isForgot = mode === "forgot";
  const isSignup = mode === "signup";

  // Zodra er een sessie is (net ingelogd of al ingelogd) door naar de
  // oorspronkelijke bestemming (of het dashboard).
  useEffect(() => {
    if (session) navigate(returnTo, { replace: true });
  }, [session, navigate, returnTo]);

  function switchMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setMessage("");
    setFouten({});
    setMailNaar(null);
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

  /** Wat is er mis met dit veld in de huidige modus? `null` = niets. */
  function valideer(veld: AuthVeld): string | null {
    switch (veld) {
      case "email":
        return emailError(email);
      case "wachtwoord":
        if (isForgot) return null;
        if (!password) return "Vul je wachtwoord in.";
        // De lengte-eis geldt bij het kiezen van een wachtwoord, niet bij het
        // intikken van een bestaand.
        return isSignup ? passwordError(password) : null;
      case "bevestig":
        return isSignup ? bevestigError(password, confirm) : null;
      case "gebruikersnaam":
        // Een bezette naam gaf voorheen stilzwijgend een andere naam (de
        // dedupe-trigger plakt er een cijfer achter). Nu blokkeert het.
        return isSignup && nameStatus === "taken" ? BEZET : null;
    }
  }

  /** Bij blur pas oordelen — niet tijdens het typen van het eerste teken. */
  function controleer(veld: AuthVeld) {
    const fout = valideer(veld);
    setFouten((f) => ({ ...f, [veld]: fout ?? undefined }));
  }

  /** Tijdens het typen verdwijnt de fout van dat veld weer. */
  function wis(veld: AuthVeld) {
    setFouten((f) => (veld in f ? { ...f, [veld]: undefined } : f));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    const nieuwe: Fouten = {};
    for (const veld of VELDEN_PER_MODUS[mode]) {
      const fout = valideer(veld);
      if (fout) nieuwe[veld] = fout;
    }
    const eersteFout = VELDEN_PER_MODUS[mode].find((v) => nieuwe[v]);
    if (eersteFout) {
      setFouten(nieuwe);
      setStatus("error");
      velden.current[eersteFout]?.focus();
      return;
    }
    setFouten({});
    setStatus("loading");

    const cleanEmail = email.trim();

    if (mode === "signin") {
      const { error } = await signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) return fail(error);
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
      if (error) return fail(error);
      // Met e-mailbevestiging aan levert signUp géén sessie: de speler moet
      // eerst de link in de bevestigingsmail openen. Alleen bij een directe
      // sessie klopt "je wordt ingelogd" (de redirect-useEffect vuurt dan).
      if (data.session) {
        return done("Account aangemaakt — je wordt ingelogd.");
      }
      // Het formulier heeft niets meer te vragen: wachtwoorden weg, en het
      // scherm vertelt wat er nu van je verwacht wordt.
      setPassword("");
      setConfirm("");
      setStatus("idle");
      setMailNaar(cleanEmail);
      return;
    }

    // mode === "forgot"
    const { error } = await resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-wachtwoord`,
    });
    if (error) return fail(error);
    return done("We hebben je een herstellink gemaild.");
  }

  /** Serverfout: bij het bijbehorende veld als die er is, anders formulierbreed. */
  function fail(error: unknown) {
    const msg = authErrorMessage(error);
    const veld = authErrorVeld(error);
    setStatus("error");
    if (!veld) return setMessage(msg);
    setMessage("");
    // "E-mail of wachtwoord klopt niet" slaat op allebei: markeer ze allebei,
    // maar zet de tekst één keer neer (bij het wachtwoord, waar je meteen
    // opnieuw kunt typen).
    const beide = veld === "wachtwoord" && mode === "signin";
    setFouten({ [veld]: msg, ...(beide ? { email: "" } : {}) });
    velden.current[veld]?.focus();
  }

  function done(msg: string) {
    setStatus("success");
    setMessage(msg);
  }

  /** Terug naar het registratieformulier met een schoon e-mailveld. */
  function anderAdres() {
    setMailNaar(null);
    setEmail("");
    setStatus("idle");
    setFouten({});
  }

  const submitLabel = loading
    ? "Bezig…"
    : isForgot
      ? "Stuur herstellink"
      : isSignup
        ? "Account aanmaken"
        : "Inloggen";

  // Alles wat onder het wachtwoordveld hangt, in leesvolgorde.
  const wachtwoordUitleg =
    [
      capsLock ? "caps-lock" : null,
      isSignup ? "wachtwoord-sterkte" : null,
      isSignup ? "wachtwoord-regel" : null,
      fouten.wachtwoord ? "fout-wachtwoord" : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

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

        {isForgot && !mailNaar && (
          <button
            type="button"
            className="login-back"
            onClick={() => switchMode("signin")}
          >
            ← Terug naar inloggen
          </button>
        )}

        <header className="login-head">
          {isForgot && !mailNaar && (
            <span className="login-eyebrow">Wachtwoord vergeten</span>
          )}
          <h1 className="login-title">
            {mailNaar
              ? "Check je mail"
              : isForgot
                ? "Wachtwoord herstellen"
                : isSignup
                  ? "Maak een account"
                  : "Welkom terug"}
          </h1>
          <p className="login-subtitle">
            {mailNaar
              ? "Nog één stap: bevestig je e-mailadres."
              : isForgot
                ? "Vul je e-mailadres in en we sturen je een herstellink."
                : isSignup
                  ? "Word lid, leg je matches vast en klim in het klassement."
                  : "Log in en zie waar je staat in het klassement."}
          </p>
        </header>

        {mailNaar ? (
          <div className="login-mailcheck">
            <p className="login-message login-message--success" role="status">
              We hebben een bevestigingsmail gestuurd naar:
            </p>
            <p className="login-mailcheck__adres">{mailNaar}</p>
            <p className="login-mailcheck__uitleg">
              Open de link in die mail om je account te activeren; daarna kun je
              inloggen. Niets ontvangen? Kijk even in je spam- of
              ongewenste-mapje. (Lokaal komt de mail binnen in Mailpit.)
            </p>
            <button
              type="button"
              className="login-link"
              onClick={anderAdres}
            >
              Ander e-mailadres gebruiken
            </button>
          </div>
        ) : (
          <>
            {!isForgot && (
              <div
                className="login-tabs"
                role="tablist"
                aria-label="Inloggen of registreren"
              >
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
                      ref={(el) => {
                        velden.current.gebruikersnaam = el;
                      }}
                      aria-invalid={nameStatus === "taken"}
                      aria-describedby={
                        nameStatus === "taken"
                          ? "fout-gebruikersnaam"
                          : nameStatus !== "idle"
                            ? "username-availability"
                            : undefined
                      }
                    />
                    {nameStatus === "taken" ? (
                      <FieldError id="fout-gebruikersnaam" text={BEZET} />
                    ) : (
                      nameStatus !== "idle" && (
                        <span
                          id="username-availability"
                          className={`field__hint field__hint--${nameStatus}`}
                          role="status"
                        >
                          {nameStatus === "checking"
                            ? "Beschikbaarheid controleren…"
                            : "✓ Deze gebruikersnaam is vrij."}
                        </span>
                      )
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    wis("email");
                  }}
                  onBlur={() => controleer("email")}
                  ref={(el) => {
                    velden.current.email = el;
                  }}
                  aria-invalid={fouten.email !== undefined}
                  aria-describedby={fouten.email ? "fout-email" : undefined}
                  required
                />
                <FieldError id="fout-email" text={fouten.email} />
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
                      onChange={(e) => {
                        setPassword(e.target.value);
                        wis("wachtwoord");
                      }}
                      {...capsProps}
                      onBlur={(e) => {
                        capsProps.onBlur();
                        if (e.target.value) controleer("wachtwoord");
                      }}
                      ref={(el) => {
                        velden.current.wachtwoord = el;
                      }}
                      aria-invalid={fouten.wachtwoord !== undefined}
                      aria-describedby={wachtwoordUitleg}
                      required
                    />
                    <button
                      type="button"
                      className="field__toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Verberg wachtwoord" : "Toon wachtwoord"
                      }
                    >
                      {showPassword ? "Verberg" : "Toon"}
                    </button>
                  </div>
                  {capsLock && (
                    <span
                      id="caps-lock"
                      className="field__hint field__hint--warn"
                      role="status"
                    >
                      ⚠ Caps Lock staat aan.
                    </span>
                  )}
                  {isSignup && (
                    <>
                      <SterkteBalk
                        id="wachtwoord-sterkte"
                        wachtwoord={password}
                      />
                      <span id="wachtwoord-regel" className="field__hint">
                        {PASSWORD_RULE}
                      </span>
                    </>
                  )}
                  <FieldError id="fout-wachtwoord" text={fouten.wachtwoord} />
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
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      wis("bevestig");
                    }}
                    {...capsProps}
                    onBlur={(e) => {
                      capsProps.onBlur();
                      if (e.target.value) controleer("bevestig");
                    }}
                    ref={(el) => {
                      velden.current.bevestig = el;
                    }}
                    aria-invalid={fouten.bevestig !== undefined}
                    aria-describedby={
                      fouten.bevestig ? "fout-bevestig" : undefined
                    }
                    required
                  />
                  <FieldError id="fout-bevestig" text={fouten.bevestig} />
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

              {/* Alleen nog voor wat het hele formulier betreft: rate limits,
                  onbekende fouten en de succesmeldingen. */}
              {message && (
                <p className={`login-message login-message--${status}`} role="status">
                  {message}
                </p>
              )}

              <button className="login-submit" type="submit" disabled={loading}>
                {submitLabel}
              </button>
            </form>
          </>
        )}

        <footer className="login-foot">
          {mailNaar ? (
            <>
              Al bevestigd?{" "}
              <button
                type="button"
                className="login-link"
                onClick={() => switchMode("signin")}
              >
                Inloggen
              </button>
            </>
          ) : isForgot ? null : isSignup ? (
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
