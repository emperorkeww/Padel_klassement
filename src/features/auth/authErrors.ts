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

/** De velden die een eigen foutmelding kunnen krijgen (#922). */
export type AuthVeld = "gebruikersnaam" | "email" | "wachtwoord" | "bevestig";

/**
 * Controleert het e-mailadres net streng genoeg om typefouten te vangen. Geen
 * regex-marathon: of het adres écht bestaat weet alleen de mailserver, en een
 * te strenge regel weigert geldige adressen.
 */
export function emailError(email: string): string | null {
  const clean = email.trim();
  if (!clean) return "Vul je e-mailadres in.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return "Dit lijkt geen geldig e-mailadres.";
  }
  return null;
}

/** Komt de bevestiging overeen met het gekozen wachtwoord? */
export function bevestigError(
  password: string,
  confirm: string,
): string | null {
  if (!confirm) return "Herhaal je wachtwoord.";
  if (password !== confirm) return "De wachtwoorden komen niet overeen.";
  return null;
}

// Bij welk veld hoort een serverfout? Codes zonder ingang horen bij het
// formulier als geheel (rate limits, onbekende fouten) en blijven algemeen.
const VELDEN: Record<string, AuthVeld> = {
  // Bewust het wachtwoordveld, mét de dubbelzinnige tekst "E-mail of wachtwoord
  // klopt niet": Supabase zegt niet wélke van de twee fout is. Maak dit niet
  // "preciezer" dan waar is — het scherm markeert daarom béide velden.
  invalid_credentials: "wachtwoord",
  email_not_confirmed: "email",
  user_already_exists: "email",
  email_exists: "email",
  validation_failed: "email",
  weak_password: "wachtwoord",
  same_password: "wachtwoord",
};

/**
 * Zegt bij welk veld een Supabase-authfout thuishoort, of `null` als de fout
 * het hele formulier betreft.
 */
export function authErrorVeld(error: unknown): AuthVeld | null {
  if (hasCode(error) && error.code) return VELDEN[error.code] ?? null;
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
