// De acties heten in de databank zoals de edge functions ze kennen; in het
// paneel lees je liever wat er gebeurd is (#1036, uitgebreid in #1159).
//
// Gedeeld tussen het per-gebruiker-logboek in GebruikerPaneel en het volledige
// logboek in LogboekTab: twee lijstjes die uiteenlopen, is een actie die op de
// ene plek "Uitslag gecorrigeerd" heet en op de andere "update_match_score".

export const AUDIT_LABEL: Record<string, string> = {
  // Accounts (#1036).
  recovery_link: "Herstel-link uitgedeeld",
  temp_password: "Tijdelijk wachtwoord gezet",
  resend_reset: "Herstelmail opnieuw verstuurd",
  fix_email: "E-mailadres gecorrigeerd",
  sign_out_all: "Overal uitgelogd",
  delete_user: "Account verwijderd",
  // Inhoud (#1159).
  update_match_score: "Uitslag gecorrigeerd",
  move_match: "Match verplaatst",
  delete_match: "Match verwijderd",
  set_poll_status: "Speeldag-status gewijzigd",
  delete_poll: "Speeldag verwijderd",
  set_group_owner: "Eigenaar overgedragen",
  remove_group_member: "Lid uit groep gehaald",
  delete_group: "Groep verwijderd",
};

/** De naam van de actie, of de rauwe sleutel als hij hier nog niet staat — dan
 *  lees je in het logboek tenminste dát er iets gebeurde. */
export function auditLabel(actie: string): string {
  return AUDIT_LABEL[actie] ?? actie;
}

/**
 * De details als één leesbare regel: `groep: Vrijdagavond · 6-3 → 6-4`. De
 * sleutels komen uit de allow-list van `_shared/adminAudit.ts` en zijn per
 * actie anders, dus dit formatteert generiek in plaats van per actie — een
 * nieuwe actie krijgt zo meteen een leesbare regel in plaats van niets.
 */
export function auditDetails(details: Record<string, unknown>): string {
  return Object.entries(details)
    .filter(([, waarde]) => waarde !== null && waarde !== "")
    .map(([sleutel, waarde]) => `${sleutel.replace(/_/g, " ")}: ${String(waarde)}`)
    .join(" · ");
}
