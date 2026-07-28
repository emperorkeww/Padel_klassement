// Handgeschreven types voor de databank-entiteiten (geen gegenereerde types).

export type MatchStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type FriendshipStatus = "pending" | "accepted" | "declined";
/** Roast-toon van een groep (#183): hoe hard het systeem de leden roast. */
export type RoastIntensiteit = "mild" | "gemeen" | "radioactief";

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  /** Door de speler uitgelichte badges (geordende lijst van badge-id's).
   *  Optioneel: synthetische profielen (bv. gasten in de UI) vullen dit niet. */
  featured_badges?: string[] | null;
  /** Verschijn je in het zoeken naar spelers? Bepaalt ook of 'nieuwe vriendschap'-
   *  items in de feed getoond worden (#59). Ontbreekt/true = zichtbaar. */
  discoverable?: boolean;
  /** Roast-schild (#183): zet de speler dit aan, dan toont het systeem overal een
   *  neutrale variant i.p.v. spot. Ontbreekt/false = schild neer. */
  roast_schild?: boolean;
  /** Persoonlijke roast-intensiteit voor de feed en het dashboard (#183): de
   *  speler kiest zelf hoe hard Coach Rudy hém in zijn eigen feed toespreekt,
   *  los van de groep-instelling van een eigenaar. Ontbreekt = 'gemeen'. */
  roast_intensiteit?: RoastIntensiteit;
  /** Cosmetische weergavevoorkeur (#542): toont het klassement de waarnemend
   *  dictator (Kylian Mbappé, #530) bovenaan zolang niemand de El Padelissimo-
   *  tier haalt? Ontbreekt/true = zichtbaar (bestaand gedrag). */
  toon_waarnemend_dictator?: boolean;
  /** AI dictator-portret opt-out (#554): staat dit uit, dan gaat de profielfoto
   *  nooit naar OpenAI en toont De Troon de gewone avatar. Ontbreekt/true = aan. */
  dictator_portret?: boolean;
  /** Publieke URL van het gegenereerde dictator-portret (#554), of null/ontbrekend
   *  als er nog geen is of het vervallen is (na een fotowissel). Alleen de edge
   *  function schrijft dit; de troon toont het voor de echte dictator. */
  dictator_avatar_url?: string | null;
  /** De avatar_url waarop het portret is gebaseerd (#554), of de sentinel
   *  '__geen_avatar__'. Wijkt dit af van de huidige avatar_url, dan is het portret
   *  vervallen en moet het opnieuw gegenereerd worden. */
  dictator_avatar_bron?: string | null;
  /** AI pias-portret opt-out (#682): staat dit uit, dan gaat de profielfoto nooit
   *  naar OpenAI en toont De Schandpaal de gewone avatar. Ontbreekt/true = aan.
   *  Los van dictator_portret — als generalissimo verschijnen betekent niet dat je
   *  ook als hofnar wil verschijnen. */
  pias_portret?: boolean;
  /** Publieke URL van het gegenereerde hofnar-portret (#682), of null/ontbrekend als
   *  er nog geen is of het vervallen is. Alleen de edge function schrijft dit. */
  pias_avatar_url?: string | null;
  /** De avatar_url waarop het hofnar-portret is gebaseerd (#682), of de sentinel
   *  '__geen_avatar__' — zelfde invalidatie-afspraak als bij de dictator. */
  pias_avatar_bron?: string | null;
  /** Gastspeler: naamloze deelnemer zonder account, aangemaakt door een lid
   *  (owner_id). Gasten tellen nergens mee in de klassementen — de globale en
   *  groepsviews filteren `not is_guest`, en de client-mirror doet hetzelfde
   *  (#468). Ontbreekt/false = echt profiel. */
  is_guest?: boolean;
  /** Eigenaar van een gastprofiel: het lid dat de gast aanmaakte (#468).
   *  null bij een echt profiel. */
  owner_id?: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string | null;
  player1_id: string;
  /** null bij een singles-"team" (1v1). */
  player2_id: string | null;
  created_at: string;
}

/** Speelvorm van een match: dubbel (standaard) of singles. */
export type MatchFormat = "1v1" | "2v2";

/** Baantype waarop gespeeld is (#471). Optioneel bij het loggen; voedt de
 *  baanvoorkeuren-statistiek op het spelersprofiel. */
export type CourtType = "binnen" | "buiten" | "panorama" | "muur";

export interface Match {
  id: string;
  team_a_id: string;
  team_b_id: string;
  status: MatchStatus;
  winner_team_id: string | null;
  played_at: string | null;
  created_by: string | null;
  created_at: string;
  group_id: string | null;
  round_number: number | null;
  score_a: number | null;
  score_b: number | null;
  format: MatchFormat;
  /** Optionele per-set uitslag (jsonb); ruwe waarde — valideer via
   *  readSetScores in features/matches/api.ts. */
  set_scores?: unknown;
  /** Baantype (#471); null/afwezig = niet opgegeven. */
  court_type?: CourtType | null;
}

export interface MatchPoint {
  id: string;
  match_id: string;
  set_number: number;
  game_number: number;
  point_number: number;
  won_by_team_id: string;
  is_golden_point: boolean;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  created_by: string | null;
  /** Roast-toon van de groep (#183); ontbreekt = 'gemeen' (de DB-default). */
  roast_intensiteit?: RoastIntensiteit;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  player_id: string;
  role: "owner" | "member";
  joined_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface TeamStanding {
  team_id: string;
  team_name: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goal_diff: number;
}

export interface PlayerStanding {
  player_id: string;
  username: string;
  full_name: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goal_diff: number;
}

export interface PlayerRating {
  player_id: string;
  rating: number;
  games: number;
  updated_at: string;
}

export interface RatingPoint {
  match_id: string;
  rating_before: number;
  rating_after: number;
  delta: number;
  played_at: string;
  /** Lef-tip-multiplier (#804), al in `delta` verwerkt: 2 = dubbel gespeeld.
   *  Optioneel omdat oudere/afgeleide bronnen (testfixtures, samengevoegde
   *  historie) hem niet altijd meeleveren. */
  stake_factor?: number;
  /** Bounty-verschuiving (#805), al in `delta` verwerkt: positief als je een
   *  bounty claimde, negatief als je er een betaalde. Optioneel om dezelfde
   *  reden als `stake_factor`. */
  bounty_delta?: number;
}
