// Zoeken en filteren over de gebruikerslijst (#1036). Pure functies, zodat de
// vragen die je écht hebt ("wie is er nooit binnengekomen?") vast te zetten zijn
// zonder een scherm te renderen. De chips zelf komen in PR 3; de predicaten
// staan hier alvast omdat ze bij de data horen en niet bij de knopjes.

import type { AdminGebruiker } from "./types";

/** Diakrietloos en kleine letters, zodat "rene" ook "René" vindt. */
function normaliseer(tekst: string): string {
  return tekst
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Zoekt op username, volledige naam en e-mailadres tegelijk. Een lege of
 * whitespace-term geeft de hele lijst terug — niet niets.
 */
export function zoekGebruikers(
  users: AdminGebruiker[],
  term: string,
): AdminGebruiker[] {
  const naald = normaliseer(term.trim());
  if (!naald) return users;
  return users.filter((u) =>
    [u.username, u.full_name, u.email].some(
      (veld) => veld && normaliseer(veld).includes(naald),
    ),
  );
}

export type AdminFilterId =
  | "nooit-ingelogd"
  | "geen-groep"
  | "geen-match"
  | "email-onbevestigd"
  | "nieuw";

export type AdminFilter = {
  id: AdminFilterId;
  label: string;
  past: (u: AdminGebruiker, nu: number) => boolean;
};

const ZEVEN_DAGEN = 7 * 24 * 60 * 60 * 1000;

/** De vragen die het paneel moet beantwoorden, in de volgorde waarin je ze
 *  stelt: eerst "wie is blijven steken", dan "wie is er net bij". */
export const ADMIN_FILTERS: readonly AdminFilter[] = [
  {
    id: "nooit-ingelogd",
    label: "Nooit ingelogd",
    // Gasten hebben geen auth-account en zijn dus per definitie nooit
    // ingelogd; die horen hier niet tussen, anders verzuipt het echte signaal.
    past: (u) => !u.is_guest && u.last_sign_in_at === null,
  },
  {
    id: "geen-groep",
    label: "Geen groep",
    past: (u) => u.aantal_groepen === 0,
  },
  {
    id: "geen-match",
    label: "Geen match",
    past: (u) => u.aantal_matches === 0,
  },
  {
    id: "email-onbevestigd",
    label: "E-mail niet bevestigd",
    past: (u) => !u.is_guest && u.email_confirmed_at === null,
  },
  {
    id: "nieuw",
    label: "Laatste 7 dagen",
    past: (u, nu) => nu - new Date(u.created_at).getTime() <= ZEVEN_DAGEN,
  },
];

/**
 * Past de aangevinkte filters toe. Meerdere filters stapelen (EN, niet OF):
 * "geen groep" plus "geen match" is de vraag "wie is aangemeld en verder nooit
 * iets gaan doen", en dat is een andere — kleinere — verzameling dan de twee
 * los.
 */
export function pasFiltersToe(
  users: AdminGebruiker[],
  actief: readonly AdminFilterId[],
  nu: number,
): AdminGebruiker[] {
  if (actief.length === 0) return users;
  const gekozen = ADMIN_FILTERS.filter((f) => actief.includes(f.id));
  return users.filter((u) => gekozen.every((f) => f.past(u, nu)));
}
