// De staat van één match, als pure functies (#1144).
//
// Tot nu toe leidde elk matchscherm zijn eigen staat af uit een reeks losse
// ternaries: PlannedMatchCard bepaalde `canScore`/`canManage` en het label van
// zijn uitklapknop, MatchDetail rekende `canEdit`/`showPlanned`/`speeltMee`
// apart uit, en RondeBlok deed het nog eens over. Dezelfde regels, drie keer
// opgeschreven — en dus drie plekken waar ze konden gaan afwijken.
//
// Hier staat het één keer, zonder React, zodat de staat te toetsen is zonder
// een pagina te renderen. Zelfde opzet en zelfde reden als matchFilter.ts,
// stakes.ts en jokers.ts: de databank blijft de enige echte poort (RLS +
// guards), dit bestand is de spiegel die de UI vooraf laat kloppen.

import { inTeam } from "@/features/rating/results";
import type { Match, Team } from "@/types";

/**
 * De fase waarin een match verkeert.
 *
 * Let op het gat tussen enum en werkelijkheid: `public.match_status` kent vier
 * waarden, maar de app schrijft er twee. `createPlannedMatch` zet 'scheduled',
 * `setMatchResult` zet 'completed'. `in_progress` wordt nergens geschreven én
 * nergens gelezen — die valt hier daarom onder "gepland" in plaats van een
 * eigen fase te krijgen die nooit voorkomt. `cancelled` wordt evenmin ergens
 * geschreven, maar wél gelezen (drankkaart, LefTipBlock, JokerBlock, rivalry,
 * americano), dus die houdt zijn eigen fase.
 */
export type MatchFase =
  | "gepland"
  | "gepland-zonder-tijd"
  | "gespeeld"
  | "gespeeld-zonder-score"
  | "afgelast";

export function matchFase(match: Match): MatchFase {
  if (match.status === "cancelled") return "afgelast";
  if (match.status === "completed") {
    // Beide cijfers moeten er staan; de check-constraint matches_result_consistent
    // laat "allebei leeg" toe en dat komt voor bij oude, half ingevoerde matches.
    return match.score_a == null || match.score_b == null
      ? "gespeeld-zonder-score"
      : "gespeeld";
  }
  return match.played_at ? "gepland" : "gepland-zonder-tijd";
}

/** Is er een uitslag om te tonen? Korter dan de fase-check op twee plekken. */
export function heeftUitslag(match: Match): boolean {
  return match.score_a != null && match.score_b != null;
}

/**
 * Wat de kijker met deze match mag. Spiegel van de policies op public.matches
 * (supabase/schemas/policies/matches.sql):
 *
 *   * aanmaker            — mag alles
 *   * deelnemer           — alleen de overgang naar 'completed' (#413)
 *   * groepseigenaar      — mag een groepsmatch volledig bijwerken (#978)
 *
 * En sinds #1159 de beheerder van de app, die overal aan mag. Die staat níet in
 * de policies: hij schrijft met de service-role via de edge function
 * `admin-content`, juist omdat een ruimere policy hem de matches van alle
 * vreemde groepen in zijn eigen feed en kwartaalstand zou geven. Vandaar
 * `alsBeheerder` hieronder — de aanroeper moet weten welke route hij neemt.
 *
 * De rechten zijn bewust *niet* met de fase vermengd: `magCorrigeren` zegt
 * "deze persoon mag een uitslag rechtzetten", niet "er valt nu iets recht te
 * zetten". Dat combineren doet `primaireActie` hieronder.
 */
export interface MatchRechten {
  /** Staat de ingelogde kijker zelf op het veld? */
  isDeelnemer: boolean;
  /** Mag de uitslag van een nog niet afgeronde match invullen. */
  magInvullen: boolean;
  /** Mag een reeds afgeronde uitslag corrigeren. */
  magCorrigeren: boolean;
  /** Mag het tijdstip verzetten en de match verwijderen. */
  magBeheren: boolean;
  /**
   * Mag wijzigen wie er in deze match staat: vervangen, van team wisselen,
   * ruilen met een andere baan (#1327). Spiegel van
   * `_mag_bezetting_wijzigen` (supabase/schemas/functions/46_match_bezetting.sql).
   *
   * Bewust een eigen recht en geen tak van `magBeheren`: op een gepláánde
   * match mag de hele kring die erbij betrokken is — de spelers zelf en de
   * leden van de groep — omdat je dan een afspraak verplaatst. Zodra de match
   * gespeeld is herschrijf je de Elo-geschiedenis van vier mensen, en dan
   * blijft het bij dezelfde kring als `magCorrigeren`.
   */
  magBezetting: boolean;
  /**
   * Komt dit recht *alleen* uit de beheerdersrol (#1159)? Dan loopt het
   * schrijfpad via `admin-content` in plaats van rechtstreeks over RLS, en
   * hoort de UI te tonen dat je als beheerder ingrijpt.
   *
   * False voor de aanmaker, de deelnemer en de groepseigenaar — ook als die
   * toevallig óók beheerder is. Wie op eigen recht mag, hoeft niet als
   * beheerder te loggen.
   */
  alsBeheerder: boolean;
  /**
   * Hetzelfde onderscheid, maar voor `magBezetting` (#1327). Een eigen vlag,
   * want de eigen-recht-basis is daar breder: een deelnemer aan een geplande
   * match mag de bezetting wijzigen zonder beheerder te zijn, terwijl
   * `alsBeheerder` hem daar wél als beheerder zou laten schrijven.
   */
  bezettingAlsBeheerder: boolean;
}

export function matchRechten(opts: {
  match: Match;
  teams: Record<string, Team>;
  /**
   * De **ingelogde** gebruiker. Alles wat je echt kunt indrukken hangt hieraan.
   */
  myId: string | null;
  /**
   * Vanuit wiens oogpunt de kaart getekend wordt. Op een profielpagina is dat
   * de profieleigenaar, niet de kijker.
   *
   * Dit onderscheid is geen slordigheid maar de kern van `magBeheren`: die tak
   * hing altijd al op `perspectiveId` (zie de comment bij `canManage` in de
   * oude PlannedMatchCard), terwijl `magInvullen` op `myId` hing. Trek die twee
   * gelijk en een profielbezoeker krijgt beheerknoppen die de server weigert —
   * of de eigenaar van een profiel verliest ze juist. Laat dus staan.
   */
  perspectiveId?: string | null;
  /** Beheert de kijker de groep waarin deze match hangt? */
  isGroupOwner?: boolean;
  /** Is de kijker beheerder van de app (#1159)? */
  isAppAdmin?: boolean;
  /**
   * Is de kijker lid van de groep waarin deze match hangt (#1327)? Alleen de
   * bezetting hangt hieraan; alle andere rechten stoppen bij de eigenaar.
   */
  isGroupMember?: boolean;
}): MatchRechten {
  const { match: m, teams, myId, perspectiveId = null } = opts;
  const isGroupOwner = opts.isGroupOwner ?? false;
  const isAppAdmin = opts.isAppAdmin ?? false;

  const isDeelnemer =
    !!myId &&
    [teams[m.team_a_id], teams[m.team_b_id]].some((t) => inTeam(t, myId));
  const benIkAanmaker = !!myId && m.created_by === myId;

  // Het eigen recht, los van de beheerdersrol: dat bepaalt of het schrijfpad
  // over RLS loopt of over de edge function.
  const eigenBeheer =
    (!!perspectiveId && m.created_by === perspectiveId) || isGroupOwner;
  const eigenCorrectie = !!myId && (benIkAanmaker || isGroupOwner);

  // De bezetting (#1327). Op een gepláánde match mag de brede kring: je
  // verplaatst een afspraak, en wie op de baan staat weet het beste wie er komt
  // opdagen. Zodra hij gespeeld is valt die kring weg — dan is het dezelfde als
  // bij een scorecorrectie.
  //
  // Hangt aan `myId` en niet aan `perspectiveId`: dit is een schrijfactie van
  // de ingelogde gebruiker, net als `magCorrigeren`.
  const isAfgerond = m.status === "completed";
  const isGroepslid = m.group_id != null && (opts.isGroupMember ?? false);
  const eigenBezetting =
    !!myId &&
    (isAfgerond
      ? benIkAanmaker || isGroupOwner
      : benIkAanmaker || isGroupOwner || isDeelnemer || isGroepslid);

  // Een beheerder zonder sessie bestaat niet, maar de check is gratis en houdt
  // de regel "alles hangt aan myId" overeind.
  const beheerder = !!myId && isAppAdmin;

  return {
    isDeelnemer,
    magInvullen:
      (!!myId && (benIkAanmaker || isGroupOwner || isDeelnemer)) || beheerder,
    magCorrigeren: eigenCorrectie || beheerder,
    magBeheren: eigenBeheer || beheerder,
    magBezetting: eigenBezetting || beheerder,
    alsBeheerder: beheerder && !eigenCorrectie && !eigenBeheer,
    bezettingAlsBeheerder: beheerder && !eigenBezetting,
  };
}

/**
 * Staat het tipvenster nog open? Alleen groepsmatches zijn tipbaar; de
 * guard-trigger dwingt dat serverside ook af. Een geplande match zonder
 * starttijd blijft tipbaar — er is geen deadline om te passeren.
 *
 * Losse regel, net als `lefGestart` en `jokerGestart`, zodat kaart, tegel en
 * detail niet uit elkaar kunnen lopen.
 */
export function tippenOpen(match: Match, now?: number): boolean {
  return (
    match.group_id != null &&
    match.status === "scheduled" &&
    (match.played_at == null ||
      new Date(match.played_at).getTime() > (now ?? Date.now()))
  );
}

/**
 * De ene dominante actie van deze match, voor deze kijker.
 *
 * Precies één per staat — dat is het hele punt van #1144. Alles wat hier niet
 * uitkomt hoort in het ⋯-menu of achter een matchoptie, niet als tweede knop
 * naast de eerste.
 */
export type PrimaireActie =
  | "uitslag-invullen"
  | "score-invoeren"
  | "match-vervolledigen"
  | "tippen"
  | "bekijken";

export function primaireActie(opts: {
  fase: MatchFase;
  rechten: MatchRechten;
  /** Uit `tippenOpen()`; bepaalt of "Tippen" een zinnige belofte is. */
  tippenOpen: boolean;
}): PrimaireActie {
  const { fase, rechten } = opts;

  if (fase === "afgelast") return "bekijken";
  if (fase === "gespeeld") return "bekijken";
  // Afgerond maar zonder cijfers: dat is geen correctie maar een gat vullen.
  if (fase === "gespeeld-zonder-score")
    return rechten.magCorrigeren ? "score-invoeren" : "bekijken";

  // Vanaf hier: nog te spelen.
  if (rechten.magInvullen) return "uitslag-invullen";
  // Een organisator die niet zelf meespeelt en de uitslag niet mag invullen,
  // kan wél de match afmaken die hij half heeft klaargezet. Bewust ná
  // `magInvullen`: voor wie de uitslag kan invullen blijft dát de hoofdzaak —
  // een tijdstip zetten is administratie, en die hoort in het ⋯-menu.
  if (fase === "gepland-zonder-tijd" && rechten.magBeheren)
    return "match-vervolledigen";
  if (opts.tippenOpen) return "tippen";
  return "bekijken";
}

/** Het opschrift van de primaire knop. Eén plek, zodat kaart en detail gelijk lopen. */
export const ACTIE_LABEL: Record<PrimaireActie, string> = {
  "uitslag-invullen": "Uitslag invullen",
  "score-invoeren": "Score invoeren",
  "match-vervolledigen": "Match vervolledigen",
  tippen: "Tippen",
  bekijken: "Details",
};
