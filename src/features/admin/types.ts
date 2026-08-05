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
