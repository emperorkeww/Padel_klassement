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
  // Alleen lezen: de systeemgezondheid (#1049). Geen auditrij — leesacties
  // laten nergens in dit paneel een spoor achter, en een dashboard dat je
  // openslaat is er daar één van.
  "system_status",
  "client_errors",
  "list_settings",
  // Muterend vanaf hier (#1036 deel 2).
  "recovery_link",
  "temp_password",
  "resend_reset",
  "fix_email",
  "sign_out_all",
  "delete_user",
  // Schakelaars zonder deploy (#1049).
  "set_setting",
  // Onderhoud en export (#1049).
  "recompute",
  "export_user",
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
  "set_setting",
  "recompute",
  // Geen mutatie, wél een auditrij: iemands volledige gegevens ophalen is
  // precies zo gevoelig als een wachtwoord uitdelen, en hoort een spoor te
  // hebben om dezelfde reden.
  "export_user",
];

export function isMuterend(actie: AdminActie): boolean {
  return MUTERENDE_ACTIES.includes(actie);
}

/**
 * De acties van de tweede beheerfunction, `admin-content` (#1159): matches,
 * groepen en polls. Een eigen lijst en geen uitbreiding van ADMIN_ACTIES, want
 * elke function kent alleen zijn eigen acties — vraag `admin-users` om
 * `delete_group` en je krijgt terecht een 400.
 *
 * `whoami` staat hier niet: die hoort bij de gebruikersfunction en de client
 * heeft er maar één nodig.
 */
export const ADMIN_INHOUD_ACTIES = [
  "list_matches",
  "list_polls",
  "list_group_members",
  "audit_recent",
  // Muterend vanaf hier.
  "update_match_score",
  "move_match",
  "replace_match_player",
  "swap_match_players",
  "delete_match",
  "set_poll_status",
  "delete_poll",
  "set_group_owner",
  "remove_group_member",
  "delete_group",
] as const;

export type AdminInhoudActie = (typeof ADMIN_INHOUD_ACTIES)[number];

/** Zie MUTERENDE_ACTIES: een losse lijst, zodat een nieuwe actie standaard
 *  buiten het logboek valt en je bewust moet kiezen. */
export const MUTERENDE_INHOUD_ACTIES: readonly AdminInhoudActie[] = [
  "update_match_score",
  "move_match",
  "replace_match_player",
  "swap_match_players",
  "delete_match",
  "set_poll_status",
  "delete_poll",
  "set_group_owner",
  "remove_group_member",
  "delete_group",
];

export function isInhoudMuterend(actie: AdminInhoudActie): boolean {
  return MUTERENDE_INHOUD_ACTIES.includes(actie);
}

export type Toegang<A extends string = AdminActie> =
  | { soort: "voer-uit"; actie: A; uid: string }
  | { soort: "weiger"; status: 400 | 401 | 403; fout: string };

export function isAdminActie(actie: unknown): actie is AdminActie {
  return (ADMIN_ACTIES as readonly unknown[]).includes(actie);
}

export function isInhoudActie(actie: unknown): actie is AdminInhoudActie {
  return (ADMIN_INHOUD_ACTIES as readonly unknown[]).includes(actie);
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
 *
 * `bekend` zegt welke acties déze function kent; laat je hem weg, dan zijn dat
 * de gebruikersacties (#1036). `admin-content` geeft ADMIN_INHOUD_ACTIES mee.
 * De uitzondering voor `whoami` geldt alleen als die actie in `bekend` staat —
 * anders zou de inhoudsfunction een niet-beheerder een "voer-uit" teruggeven
 * voor een actie die ze niet eens heeft.
 */
export function bepaalToegang<A extends string = AdminActie>(opties: {
  uid: string | null;
  isAdmin: boolean;
  actie: unknown;
  bekend?: readonly A[];
}): Toegang<A> {
  const { uid, isAdmin, actie } = opties;
  const bekend: readonly string[] = opties.bekend ?? ADMIN_ACTIES;

  if (!uid) return { soort: "weiger", status: 401, fout: "Niet ingelogd" };

  if (actie === "whoami" && bekend.includes("whoami")) {
    return { soort: "voer-uit", actie: "whoami" as A, uid };
  }

  if (!isAdmin) return { soort: "weiger", status: 403, fout: "Geen toegang" };

  if (typeof actie !== "string" || !bekend.includes(actie)) {
    return { soort: "weiger", status: 400, fout: "Onbekende actie" };
  }

  return { soort: "voer-uit", actie: actie as A, uid };
}
