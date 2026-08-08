// Vormen die de edge function `admin-users` teruggeeft (#1036).
//
// Met de hand geschreven en niet uit database.types.ts afgeleid: de RPC's
// erachter zijn service-role-only, dus ze verschijnen nooit als client-callable
// in de gegenereerde typen. Wijzigt admin_users_overzicht() van vorm, dan
// wijzigt dit bestand mee — dat is de prijs van een tabel die de client
// bewust niet mag zien.

export type AdminGebruiker = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_guest: boolean;
  owner_id: string | null;
  /** Null voor gasten: die hebben geen auth-account. */
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  is_admin: boolean;
  aantal_groepen: number;
  aantal_matches: number;
  aantal_gasten: number;
};

export type AdminDetailGroep = {
  id: string;
  name: string;
  role: string;
  joined_at: string;
  is_eigenaar: boolean;
};

export type AdminDetailMatch = {
  id: string;
  played_at: string | null;
  status: string;
  score_a: number | null;
  score_b: number | null;
  groep: string | null;
};

export type AdminDetailGast = {
  id: string;
  username: string;
  full_name: string | null;
  created_at: string;
};

export type AdminDetail = {
  groepen: AdminDetailGroep[];
  matches: AdminDetailMatch[];
  gasten: AdminDetailGast[];
  push_subscripties: number;
};

export type AdminAuditRegel = {
  id: number;
  actor_id: string;
  actor_username: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  /** Alleen gevuld door audit_recent (#1159); het per-gebruiker-logboek laat ze
   *  weg, want daar is de gebruiker zelf het onderwerp. */
  target_user_id?: string | null;
  target_username?: string | null;
  target_type?: "match" | "group" | "poll" | null;
  target_id?: string | null;
};

export type AdminGast = {
  id: string;
  username: string;
  full_name: string | null;
  created_at: string;
  owner_id: string | null;
  owner_username: string | null;
  aantal_matches: number;
  /** Openstaand koppelverzoek (#681), of null. */
  open_claim: {
    player_id: string;
    player_username: string;
    requested_by: string;
    created_at: string;
  } | null;
};

export type AdminGroep = {
  id: string;
  name: string;
  created_at: string;
  /** Null = deze groep heeft geen eigenaar meer en is daarmee onbeheerbaar. */
  created_by: string | null;
  eigenaar_username: string | null;
  aantal_leden: number;
  aantal_matches: number;
  laatste_match: string | null;
};

// ---- Inhoud (#1159) ---------------------------------------------------------

export type AdminMatch = {
  id: string;
  played_at: string | null;
  created_at: string;
  status: string;
  score_a: number | null;
  score_b: number | null;
  /** Rauwe jsonb uit de kolom: paren [a, b] per set, of null. */
  set_scores: number[][] | null;
  winner_team_id: string | null;
  team_a_id: string;
  team_b_id: string;
  /** Null voor een match buiten elke groep. */
  group_id: string | null;
  groep_naam: string | null;
  /** Gebruikersnamen; één bij een 1v1. */
  team_a_spelers: string[];
  team_b_spelers: string[];
  created_by: string | null;
  aanmaker_username: string | null;
  /** Aantal matches dat aan het filter voldoet, vóór de limiet. */
  totaal: number;
};

export type AdminPoll = {
  id: string;
  group_id: string;
  groep_naam: string;
  status: string;
  created_at: string;
  created_by: string;
  aanmaker_username: string | null;
  /** Het vastgelegde moment als "DD-MM-JJJJ HH:MM"; null zolang er geen is. */
  vastgelegd_op: string | null;
  aantal_opties: number;
  aantal_stemmen: number;
};

export type AdminGroepLid = {
  player_id: string;
  username: string;
  full_name: string | null;
  role: string;
  is_guest: boolean;
  joined_at: string;
  is_eigenaar: boolean;
};

// ---- Systeemgezondheid (#1049) ---------------------------------------------

/** Spiegelt CronStatus uit supabase/functions/_shared/cronGezondheid.ts. */
export type SysteemCronStatus =
  | "ok"
  | "uit"
  | "mislukt"
  | "laat"
  | "nooit"
  | "onbekend";

export type SysteemCronJob = {
  jobname: string;
  schedule: string;
  actief: boolean;
  laatste_start: string | null;
  laatste_einde: string | null;
  laatste_status: string | null;
  /** Gemaskeerd door de RPC: cron-commando's bevatten het CRON_SECRET. */
  laatste_bericht: string | null;
  /** Geveld door de edge function, op de serverklok. */
  oordeel: {
    status: SysteemCronStatus;
    stilMinuten: number | null;
    drempel: number | null;
  };
};

export type SysteemFunctie = {
  naam: string;
  rol: string;
  verifyJwt: boolean;
  cronGeheim: boolean;
  /** Vereiste secrets die het project níét gezet heeft. */
  ontbrekend: string[];
};

export type SysteemStatus = {
  databank: {
    /** Null als er geen pg_cron is — dat is de normale toestand lokaal. */
    cron: SysteemCronJob[] | null;
    tabellen: { tabel: string; rijen: number }[];
    migratie: { versie: string; naam: string | null } | null;
    push: {
      abonnementen: number;
      gebruikers: number;
      oudste: string | null;
      nieuwste: string | null;
    };
    gemeten_op: string;
  };
  /** Per sleutel enkel of hij gezet is; nooit de waarde. */
  secrets: Record<string, boolean>;
  functies: SysteemFunctie[];
};

// ---- Foutenlogboek (#1049) -------------------------------------------------

export type FoutGroep = {
  boodschap: string;
  scope: string | null;
  bron: string;
  /** Een verdwenen chunk na een deploy is verwacht gedrag, geen bug (#733). */
  chunk: boolean;
  aantal: number;
  /** Hoeveel verschillende tabs dit raakte — één sessie is meestal één lus. */
  sessies: number;
  eerste: string;
  laatste: string;
  /** Hoogstens vijf, door de RPC afgekapt. */
  paden: string[] | null;
  releases: string[] | null;
  voorbeeld_stack: string | null;
  voorbeeld_component_stack: string | null;
};
