// Autorisatiebeslissing van het adminpaneel (#1036).
//
// Zelfde opzet als cronAuth.ts (#460): de beslissing zelf is een pure functie
// zonder Deno-globals, netwerk of clients, zodat ze met Vitest vast te zetten is
// (zie adminAuth.test.ts). De edge function eromheen haalt alleen de feiten op
// — wie ben je, ben je beheerder — en voert uit wat hier besloten wordt.
//
// Fail-closed: elk pad dat niet expliciet "voer-uit" oplevert, weigert.

/** Alle acties die de function kent. Alles daarbuiten is een 400. */
export const ADMIN_ACTIES = [
  "whoami",
  "list_users",
  "user_detail",
  "audit_log",
  "list_guests",
  "list_groups",
  // Muterend vanaf hier (#1036 deel 2).
  "recovery_link",
  "temp_password",
  "resend_reset",
  "fix_email",
  "sign_out_all",
  "delete_user",
] as const;

export type AdminActie = (typeof ADMIN_ACTIES)[number];

/**
 * Acties die iets aan een account veranderen en dus een auditrij moeten
 * achterlaten. Losse lijst in plaats van "alles behalve de leesacties": een
 * nieuwe actie valt zo standaard buiten het logboek in plaats van er stilzwijgend
 * in te vallen met een lege details — de dispatcher dwingt af dat je kiest.
 */
export const MUTERENDE_ACTIES: readonly AdminActie[] = [
  "recovery_link",
  "temp_password",
  "resend_reset",
  "fix_email",
  "sign_out_all",
  "delete_user",
];

export function isMuterend(actie: AdminActie): boolean {
  return MUTERENDE_ACTIES.includes(actie);
}

export type Toegang =
  | { soort: "voer-uit"; actie: AdminActie; uid: string }
  | { soort: "weiger"; status: 400 | 401 | 403; fout: string };

export function isAdminActie(actie: unknown): actie is AdminActie {
  return (ADMIN_ACTIES as readonly unknown[]).includes(actie);
}

/**
 * Beslist of een aanroep door mag. De volgorde van de stappen ís de
 * beveiliging en wordt als zodanig getest:
 *
 *  1. geen geldige sessie            -> 401
 *  2. `whoami`                       -> altijd door (antwoord is enkel of je
 *                                       zelf beheerder bent; nodig om het
 *                                       menu-item te kunnen tonen)
 *  3. geen beheerder                 -> 403, en wel VÓÓR de actie-validatie:
 *                                       anders kan een buitenstaander aan de
 *                                       foutcode (400 vs 403) aflezen welke
 *                                       acties bestaan
 *  4. onbekende actie                -> 400
 *
 * Het 403-antwoord is altijd letterlijk hetzelfde, ongeacht welke actie
 * gevraagd werd en ongeacht of het doelaccount bestaat.
 */
export function bepaalToegang(opties: {
  uid: string | null;
  isAdmin: boolean;
  actie: unknown;
}): Toegang {
  const { uid, isAdmin, actie } = opties;

  if (!uid) return { soort: "weiger", status: 401, fout: "Niet ingelogd" };

  if (actie === "whoami") return { soort: "voer-uit", actie: "whoami", uid };

  if (!isAdmin) return { soort: "weiger", status: 403, fout: "Geen toegang" };

  if (!isAdminActie(actie)) {
    return { soort: "weiger", status: 400, fout: "Onbekende actie" };
  }

  return { soort: "voer-uit", actie, uid };
}
