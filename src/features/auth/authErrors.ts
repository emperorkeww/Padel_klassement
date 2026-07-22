// Vertaalt Supabase-authfouten en client-side wachtwoordregels naar Nederlandse,
// begrijpelijke meldingen. De hele auth-flow is verder NL; rauwe Engelse
// Supabase-teksten ("Invalid login credentials") horen hier niet thuis.

/** Minimale wachtwoordlengte — Supabase' default is óók 6. Gedeeld door
 *  registratie en de reset-flow, zodat de eis overal gelijk is. */
export const PASSWORD_MIN_LENGTH = 6;

/** Zichtbare eistekst; toon 'm vooraf én gebruik 'm als foutmelding. */
export const PASSWORD_RULE = `Minstens ${PASSWORD_MIN_LENGTH} tekens.`;

/**
 * Client-side wachtwoordcontrole vóór submit. Geeft `null` als het wachtwoord
 * voldoet, anders de te tonen foutmelding.
 */
export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Kies een wachtwoord van minstens ${PASSWORD_MIN_LENGTH} tekens.`;
  }
  return null;
}

// Bekende Supabase-foutcodes → NL. We mappen op `error.code` (stabiel vanaf
// auth-js v2) i.p.v. op `error.message` (Engelse, wijzigende tekst).
const MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail of wachtwoord klopt niet.",
  email_not_confirmed: "Bevestig eerst je e-mailadres via de link in de mail.",
  user_already_exists: "Er bestaat al een account met dit e-mailadres.",
  email_exists: "Er bestaat al een account met dit e-mailadres.",
  weak_password: `Kies een wachtwoord van minstens ${PASSWORD_MIN_LENGTH} tekens.`,
  same_password: "Kies een wachtwoord dat verschilt van je huidige.",
  over_email_send_rate_limit:
    "Te veel pogingen. Wacht even en probeer het opnieuw.",
  over_request_rate_limit:
    "Te veel pogingen. Wacht even en probeer het opnieuw.",
  validation_failed: "Controleer je e-mailadres.",
};

const FALLBACK = "Er ging iets mis. Probeer het opnieuw.";

/** Bevat het genoeg om een `code` van te lezen? (Supabase `AuthError`.) */
function hasCode(error: unknown): error is { code?: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

/**
 * Zet een Supabase-authfout om naar een NL-melding. Onbekende of ontbrekende
 * codes vallen terug op een generieke tekst — nooit de rauwe Engelse message.
 */
export function authErrorMessage(error: unknown): string {
  if (hasCode(error) && error.code && MESSAGES[error.code]) {
    return MESSAGES[error.code];
  }
  return FALLBACK;
}
