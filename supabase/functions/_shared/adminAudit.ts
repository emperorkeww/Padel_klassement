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

  // Inhoudsacties (#1159). Wélke match, groep of poll het was, staat in de
  // kolommen target_type/target_id; hier staat wat er veranderde. Bij de
  // verwijderingen is dit opnieuw het enige wat overblijft — de rij zelf is dan
  // weg, dus de groep, de uitslag en de deelnemers staan erbij.
  update_match_score: ["groep", "oude_uitslag", "nieuwe_uitslag"],
  move_match: ["groep", "oud_moment", "nieuw_moment"],
  delete_match: ["groep", "status", "uitslag", "spelers"],
  set_poll_status: ["groep", "moment", "oude_status", "nieuwe_status"],
  delete_poll: ["groep", "moment", "status", "stemmen"],
  set_group_owner: ["groep", "oude_eigenaar", "nieuwe_eigenaar"],
  remove_group_member: ["groep", "lid"],
  delete_group: ["groep", "leden", "matches", "polls"],

  // Schakelaars zonder deploy (#1049). Wélke schakelaar en wat hij werd; de
  // teller (`gebruikt`/`dag`) hoort er niet in — die verandert vanzelf en zou
  // het logboek vullen met ruis waar niemand naar zoekt.
  set_setting: ["sleutel", "van", "naar", "dagbudget"],
};

/**
 * Velden die als e-mailadres gemaskeerd het logboek in gaan — per actie, niet
 * per veldnaam. Dat scheelt een valkuil: "van" en "naar" zijn bij fix_email
 * adressen, maar bij een score-correctie of een verplaatsing juist niet, en een
 * naamgebaseerde regel zou die stilzwijgend tot "onbekend" verminken.
 */
const MASKEER_ALS_EMAIL: Record<string, readonly string[]> = {
  fix_email: ["van", "naar"],
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

  const maskeren = MASKEER_ALS_EMAIL[actie] ?? [];
  const uit: Record<string, unknown> = {};
  for (const veld of toegestaan) {
    const waarde = payload[veld];
    if (waarde === undefined || waarde === null) continue;
    // E-mailvelden gaan altijd gemaskeerd het logboek in, ook als de aanroeper
    // het volledige adres meegeeft.
    uit[veld] = maskeren.includes(veld)
      ? maskeerEmail(waarde) ?? "onbekend"
      : waarde;
  }
  return uit;
}
