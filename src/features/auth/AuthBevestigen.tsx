import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { EmailOtpType } from "@supabase/supabase-js";
import { verifyOtp } from "./api";
import { BallIcon } from "@/ui/BallIcon";
import { useToast } from "@/ui/ToastProvider";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import "./LoginScreen.css";

/**
 * Landingspagina van elke auth-mail (#1037).
 *
 * De sjablonen linken hierheen met `?token_hash=…&type=…` in plaats van naar
 * Supabase' `{{ .ConfirmationURL }}`. Reden: de client draait op
 * `flowType: "pkce"` (lib/supabase/client.ts), en die flow wisselt de code in
 * met een `code_verifier` uit de localStorage van de bróuser die de mail
 * aanvroeg. Vraag je herstel aan op je laptop en open je de mail op je
 * telefoon, dan bestaat die verifier daar niet en kreeg je "deze herstellink is
 * ongeldig of verlopen" — terwijl er niets mis was met de link.
 *
 * `verifyOtp` met een token_hash heeft die verifier niet nodig en werkt dus op
 * elk apparaat. Bijkomend voordeel: de link wijst naar ons eigen domein, dus
 * een linkscanner die de URL alleen ophaalt zonder JavaScript uit te voeren
 * verbruikt het eenmalige token niet.
 */

/** Waar je heen gaat zodra de sessie er is, en wat je daarbij te horen krijgt. */
const NA_BEVESTIGING: Record<string, { pad: string; melding?: string }> = {
  // Het herstelscherm spreekt voor zich; geen toast eroverheen.
  recovery: { pad: "/reset-wachtwoord" },
  // Een uitgenodigde gebruiker heeft nog geen wachtwoord: zelfde scherm.
  invite: { pad: "/reset-wachtwoord" },
  signup: { pad: "/", melding: "Je e-mailadres is bevestigd. Welkom bij Vamos!" },
  email_change: { pad: "/profiel", melding: "Je e-mailadres is gewijzigd." },
  magiclink: { pad: "/" },
};

export function AuthBevestigen() {
  usePageTitle("Bevestigen");
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [fout, setFout] = useState("");

  const tokenHash = params.get("token_hash");
  const type = params.get("type");

  // Het token is eenmalig: een tweede verifyOtp faalt gegarandeerd. In
  // StrictMode draait dit effect in dev twee keer, dus de vlag is geen
  // nettigheid maar het verschil tussen werken en niet werken.
  const gedaan = useRef(false);

  useEffect(() => {
    if (gedaan.current) return;
    gedaan.current = true;

    if (!tokenHash || !type || !NA_BEVESTIGING[type]) {
      setFout(
        "Deze link is onvolledig. Vraag een nieuwe aan vanaf het inlogscherm.",
      );
      return;
    }

    // Bewust géén "afgebroken"-vlag in een cleanup. StrictMode doet
    // mount → cleanup → mount; de tweede mount stopt op `gedaan`, waardoor de
    // nog lopende await uit de eerste ronde terugkomt in een closure die dan al
    // afgebroken heet — en dus nooit navigeert. De ref garandeert al dat dit
    // maar één keer draait; dat is hier de enige bescherming die nodig is.
    void (async () => {
      const { error } = await verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });
      if (error) {
        // Eén boodschap voor alle gevallen: verlopen, al gebruikt, of
        // ongeldig. Het onderscheid helpt de gebruiker niet en zou een
        // aanvaller vertellen welke tokens bestaan.
        setFout(
          "Deze link is ongeldig of verlopen. Vraag een nieuwe aan vanaf het inlogscherm.",
        );
        return;
      }
      const { pad, melding } = NA_BEVESTIGING[type];
      if (melding) toast.success(melding);
      navigate(pad, { replace: true });
    })();
  }, [tokenHash, type, navigate, toast]);

  return (
    <div className="login">
      <main className="login-card" role="main">
        <div className="login-brand">
          <BallIcon />
          <span className="login-brand__name">Vamos!</span>
        </div>

        <header className="login-head">
          <h1 className="login-title">Even bevestigen</h1>
        </header>

        {fout ? (
          <>
            <p className="login-message login-message--error" role="status">
              {fout}
            </p>
            <p className="login-foot">
              <Link className="login-link" to="/login">
                ← Terug naar inloggen
              </Link>
            </p>
          </>
        ) : (
          <p className="login-subtitle" role="status">
            Bezig met bevestigen…
          </p>
        )}
      </main>
    </div>
  );
}

export default AuthBevestigen;
