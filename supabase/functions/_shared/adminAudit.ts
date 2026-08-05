// Wat er van een adminactie in het auditspoor terechtkomt (#1036).
//
// Het logboek bestaat om te kunnen zeggen "wie deed wat, voor wie". Het bestaat
// NIET om het uitgedeelde geheim te bewaren. Een tijdelijk wachtwoord of een
// herstel-link in `details` zou van dit logboek precies de bak maken waar je
// bang voor bent: één lek en elk account dat ooit hulp kreeg ligt open.
//
// Daarom een allow-list per actie in plaats van een deny-list op sleutelnamen.
// Een deny-list vergeet je uit te breiden zodra er een veld bijkomt; bij een
// allow-list valt een nieuw veld standaard buiten het logboek en moet je
// bewust besluiten het toe te laten.
//
// Puur, zonder Deno-globals, zodat het te unit-testen is (zie adminAudit.test.ts).

/** Velden die per actie wél in `details` mogen. Al het overige valt weg. */
const TOEGESTAAN: Record<string, readonly string[]> = {
  recovery_link: ["vervalt_over_minuten"],
  temp_password: [],
  resend_reset: [],
  fix_email: ["van", "naar"],
  sign_out_all: ["sessies"],
  // Bij een verwijdering is de rij zelf het bewijs: het profiel bestaat
  // daarna niet meer, dus username en de aantallen zijn het enige wat nog
  // vertelt wie dit was en hoeveel er meeging.
  delete_user: ["username", "gasten", "groepen_zonder_eigenaar"],
};

/**
 * Maakt een e-mailadres herkenbaar zonder het voluit te loggen: `r***@x.be`.
 * Genoeg om in het logboek te zien wélk adres gecorrigeerd werd, te weinig om
 * het logboek een adresboek te maken.
 */
export function maskeerEmail(email: unknown): string | undefined {
  if (typeof email !== "string" || !email.includes("@")) return undefined;
  const [lokaal, domein] = email.split("@");
  const kop = lokaal.slice(0, 1);
  return `${kop}***@${domein}`;
}

/**
 * Filtert de payload van een actie tot wat er in het auditspoor mag. Onbekende
 * acties leveren een leeg object op — fail-closed, net als overal in dit paneel.
 */
export function veiligeDetails(
  actie: string,
  payload: Record<string, unknown> = {},
): Record<string, unknown> {
  const toegestaan = TOEGESTAAN[actie];
  if (!toegestaan) return {};

  const uit: Record<string, unknown> = {};
  for (const veld of toegestaan) {
    const waarde = payload[veld];
    if (waarde === undefined || waarde === null) continue;
    // E-mailvelden gaan altijd gemaskeerd het logboek in, ook als de aanroeper
    // het volledige adres meegeeft.
    uit[veld] =
      veld === "van" || veld === "naar" ? maskeerEmail(waarde) ?? "onbekend" : waarde;
  }
  return uit;
}
