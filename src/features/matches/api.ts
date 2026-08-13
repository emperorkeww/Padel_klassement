import { supabase } from "@/lib/supabase/client";
import { cached, cachedMany, invalidate } from "@/lib/supabase/queryCache";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import type { CourtType, Match, Profile, Team } from "@/types";
import { displayName } from "@/features/profiles/api";

// Alles wat een uitslag raakt: matchlijsten, standen (views), teams (nieuwe
// paren bij het loggen), ratings (trigger herrekent ze), tips (de
// grading-trigger beoordeelt ze bij een uitslag of correctie, #116), de pias
// (de trigger duidt 'm bij elke uitslag opnieuw aan) en de Zwarte Piet (die
// verhuist ook bij elke uitslag, #185). Moet in de pas lopen met
// CACHE_PREFIXES.matches in useRealtime.ts, anders blijven pias/piet op de
// invoerende client stale tot de cache-TTL verloopt (#603).
export function invalidateMatchData() {
  invalidate(
    "matches",
    "standings",
    "teams",
    "ratings",
    "match-predictions",
    "prediction-standings",
    "pias",
    "shame",
    // Dragerschap en de verdedigd-feedstatus kunnen na een uitslag wijzigen.
    "bounties",
    // Netrollers hangen aan de match: een verwijdering cascadeert ze weg (#809).
    "net-touches",
  );
}

// Per-set uitslag: paar [games team A, games team B].
export type SetScore = [number, number];

/** Leest de optionele per-set uitslag van een match veilig uit (jsonb-kolom).
 *  Ongeldige/halfvolle data wordt genegeerd. */
export function readSetScores(match: Match): SetScore[] | null {
  const raw = match.set_scores;
  if (!Array.isArray(raw)) return null;
  const sets = raw.filter(
    (s): s is SetScore =>
      Array.isArray(s) &&
      s.length === 2 &&
      typeof s[0] === "number" &&
      typeof s[1] === "number",
  );
  return sets.length > 0 ? sets : null;
}

/** "6-4 3-6 7-5" voor weergave; lege input geeft een lege string. */
export function formatSetScores(sets: SetScore[] | null | undefined): string {
  if (!sets || sets.length === 0) return "";
  return sets.map(([a, b]) => `${a}-${b}`).join(" ");
}

/** Eén bewerkbare set-rij in de UI; lege strings = nog niet ingevuld. */
export type SetPair = { a: string; b: string };

export const emptySet = (): SetPair => ({ a: "", b: "" });

/** Bewerkbare rijen -> [games A, games B]-paren. Half-lege of ongeldige rijen
 *  vallen weg, zodat een lege set-invoer gewoon "geen set-stand" betekent. */
export function toSetScores(sets: SetPair[]): SetScore[] {
  const out: SetScore[] = [];
  for (const s of sets) {
    if (s.a === "" || s.b === "") continue;
    const a = Number(s.a);
    const b = Number(s.b);
    if (Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b >= 0)
      out.push([a, b]);
  }
  return out;
}

export function getMatch(id: string): Promise<Match | null> {
  return cached(`matches:one:${id}`, async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
}

export function getTeamsMap(): Promise<Record<string, Team>> {
  return cached("teams:all", async () => {
    // Deze map moet compleet zijn: een afgekapte teams-map betekent stil
    // "Onbekend team" bij oudere matches, dus pagineren i.p.v. hopen dat het
    // onder max_rows blijft (#731). Sortering op de sleutel houdt de pagina's
    // sluitend.
    const rows = await fetchAllPages((from, to) =>
      supabase.from("teams").select("*").order("id").range(from, to),
    );
    return Object.fromEntries(rows.map((t) => [t.id, t]));
  });
}

/** Alleen de opgegeven teams — voor pagina's die er maar enkele nodig hebben.
 *  Cachet per team-id (#738), zodat wedstrijden met overlappende teams elkaars
 *  entries hergebruiken in plaats van per combinatie een eigen entry te maken. */
export function getTeamsByIds(ids: string[]): Promise<Record<string, Team>> {
  return cachedMany<Team>("teams:one:", ids, async (missing) => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .in("id", missing);
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((t) => [t.id, t]));
  });
}

/** Wanneer er gespeeld is: alleen wat de agenda nodig heeft om een dag te
 *  markeren (#1182). */
export type MatchDag = {
  id: string;
  group_id: string | null;
  played_at: string | null;
};

/**
 * Afgeronde matches van een aantal groepen binnen een tijdvenster (#1182).
 *
 * De agenda kende tot nu toe alleen speeldagen, dus een dag waarop wél gepadeld
 * is maar zonder poll meldde "er stond geen speeldag op". Dit haalt precies drie
 * kolommen op — meer heeft een markering niet nodig, en een maandvenster kan
 * honderden matches dragen.
 *
 * De sleutel begint met "matches", dus `CACHE_PREFIXES.matches` maakt hem al
 * leeg zodra er een uitslag verandert; daar hoeft niets bij.
 */
export function getMatchDaysInWindow(
  groupIds: string[],
  fromIso: string,
  toIso: string,
): Promise<MatchDag[]> {
  if (groupIds.length === 0) return Promise.resolve([]);
  const sleutel = `matches:agenda:${[...groupIds].sort().join(",")}:${fromIso}:${toIso}`;
  return cached(sleutel, async () => {
    return fetchAllPages<MatchDag>((from, to) =>
      supabase
        .from("matches")
        .select("id, group_id, played_at")
        .eq("status", "completed")
        .in("group_id", groupIds)
        .gte("played_at", fromIso)
        .lte("played_at", toIso)
        .order("played_at")
        .order("id")
        .range(from, to),
    );
  });
}

export function getGroupMatches(groupId: string): Promise<Match[]> {
  return cached(`matches:group:${groupId}`, async () => {
    // De stand van een groep telt élke match mee, dus deze lijst mag niet
    // stilletjes op max_rows eindigen (#731). `id` als laatste sorteersleutel
    // maakt de paginering deterministisch.
    //
    // Nieuwste eerst, en dat is sinds #1271 de speeltijd en niet het
    // rondenummer: rondes tellen nu binnen hún speeldag, dus "ronde 8" van
    // vorige week zou anders boven "ronde 1" van vanavond komen te staan. Het
    // rondenummer blijft de tweede sleutel, zodat de rondes van één avond in de
    // goede volgorde onder elkaar staan.
    return fetchAllPages((from, to) =>
      supabase
        .from("matches")
        .select("*")
        .eq("group_id", groupId)
        .order("played_at", { ascending: false, nullsFirst: false })
        .order("round_number", { ascending: false })
        .order("created_at", { ascending: true })
        .order("id")
        .range(from, to),
    );
  });
}

/** Recente matches waarin een speler meedeed (via zijn teams). */
export function getPlayerMatches(
  playerId: string,
  limit = 20,
): Promise<Match[]> {
  return cached(`matches:player:${playerId}:${limit}`, async () => {
    const { data: teamRows, error: te } = await supabase
      .from("teams")
      .select("id")
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
    if (te) throw te;
    const ids = (teamRows ?? []).map((t) => t.id);
    if (ids.length === 0) return [];

    const list = ids.join(",");
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .or(`team_a_id.in.(${list}),team_b_id.in.(${list})`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  });
}

/** Afgeronde matches binnen [start, einde) — voor de seizoensstand. */
export function getCompletedMatchesBetween(
  startIso: string,
  endIso: string,
): Promise<Match[]> {
  return cached(`matches:between:${startIso}:${endIso}`, async () => {
    // Een kwartaalstand mag geen matches missen (#731).
    return fetchAllPages((from, to) =>
      supabase
        .from("matches")
        .select("*")
        .eq("status", "completed")
        .gte("played_at", startIso)
        .lt("played_at", endIso)
        .order("id")
        .range(from, to),
    );
  });
}

/** Datum van de allereerste match (bepaalt de seizoenslijst); null zonder matches.
 *  Via een SECURITY DEFINER RPC (#461): de seizoenspicker-grens moet globaal
 *  blijven, ook al is de ruwe matches-tabel sinds #461 niet meer publiek. */
export function getFirstMatchDate(): Promise<string | null> {
  return cached("matches:first", async () => {
    const { data, error } = await supabase.rpc("first_match_date");
    if (error) throw error;
    return data ?? null;
  });
}

export function getRecentMatches(limit = 20): Promise<Match[]> {
  return cached(`matches:recent:${limit}`, async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  });
}

/** Laatst gespeelde uitslagen (alleen afgeronde matches), nieuwste eerst. */
export function getRecentResults(limit = 6): Promise<Match[]> {
  return cached(`matches:results:${limit}`, async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "completed")
      .order("played_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  });
}

/** Maakt een gastspeler aan (naam-only, geen account) en geeft zijn id terug.
 *  De gast is eigendom van de ingelogde gebruiker en kan meteen in een match. */
export async function createGuestPlayer(name: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_guest_player", {
    p_name: name,
  });
  if (error) throw error;
  // De gecachte profielenlijst is nu verouderd: wissen zodat de gast overal
  // (spelerskiezer, groep-leden) meteen met zijn naam verschijnt i.p.v. "Onbekend".
  invalidate("profiles");
  return data as string;
}

/** Parameters voor createCompletedMatch. `clientToken` is de optionele
 *  idempotentie-sleutel (#462): met dezelfde token maakt een tweede poging (na
 *  een verloren antwoord of een offline replay) geen duplicaat — de RPC geeft de
 *  bestaande match terug. */
export type CreateCompletedMatchParams = {
  a1: string;
  a2: string | null;
  b1: string;
  b2: string | null;
  winner: "a" | "b" | "draw";
  scoreA?: number | null;
  scoreB?: number | null;
  groupId?: string | null;
  setScores?: SetScore[] | null;
  courtType?: CourtType | null;
  clientToken?: string;
};

/** Logt een afgeronde match via de SECURITY DEFINER RPC.
 *  1v1 (singles): a2 en b2 beide null. */
export async function createCompletedMatch(
  params: CreateCompletedMatchParams,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_completed_match", {
    p_a1: params.a1,
    // De gegenereerde RPC-Args kennen geen nullable parameters; de RPC zelf
    // accepteert null (1v1) en valideert de combinatie.
    p_a2: params.a2 as string,
    p_b1: params.b1,
    p_b2: params.b2 as string,
    p_winner: params.winner,
    p_score_a: params.scoreA ?? undefined,
    p_score_b: params.scoreB ?? undefined,
    p_group_id: params.groupId ?? undefined,
    p_set_scores: params.setScores ?? undefined,
    p_court_type: params.courtType ?? undefined,
    p_client_token: params.clientToken ?? undefined,
  });
  if (error) throw error;
  invalidateMatchData();
  return data as string;
}

/** Parameters voor createPlannedMatch. Zie CreateCompletedMatchParams voor
 *  `clientToken` (#462). */
export type CreatePlannedMatchParams = {
  a1: string;
  a2: string | null;
  b1: string;
  b2: string | null;
  playedAt?: string | null;
  groupId?: string | null;
  setScores?: SetScore[] | null;
  courtType?: CourtType | null;
  clientToken?: string;
  /** Drankje-inzet (#1004): slug uit drankkaart.ts; null = nergens om spelen. */
  wagerDrink?: string | null;
  /** Consumpties per winnaar; genegeerd zonder wagerDrink. */
  wagerDrinkQty?: number | null;
};

/** Plant een match vooraf (status 'scheduled') via de SECURITY DEFINER RPC.
 *  playedAt is het optionele geplande tijdstip; de uitslag volgt later via
 *  setMatchResult (inline op de kaart "Te spelen"). */
export async function createPlannedMatch(
  params: CreatePlannedMatchParams,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_planned_match", {
    p_a1: params.a1,
    // Zie createCompletedMatch: null = 1v1, de RPC valideert.
    p_a2: params.a2 as string,
    p_b1: params.b1,
    p_b2: params.b2 as string,
    p_played_at: params.playedAt ?? undefined,
    p_group_id: params.groupId ?? undefined,
    p_set_scores: params.setScores ?? undefined,
    p_court_type: params.courtType ?? undefined,
    p_client_token: params.clientToken ?? undefined,
    p_wager_drink: params.wagerDrink ?? undefined,
    p_wager_drink_qty: params.wagerDrink
      ? (params.wagerDrinkQty ?? 1)
      : undefined,
  });
  if (error) throw error;
  invalidateMatchData();
  return data as string;
}

/** Zet of wist de drankje-inzet van een geplande match (#1004). Kan door de
 *  spelers, de aanmaker en de groepseigenaar, tot aan de aftrap; de RPC
 *  bewaakt dat. Nodig náást de parameter op createPlannedMatch, omdat
 *  gegenereerde rondes (americano/mexicano/fair round) nooit langs de wizard
 *  komen. drink = null haalt de inzet er weer af. */
export async function setMatchWager(params: {
  matchId: string;
  drink: string | null;
  qty?: number;
}): Promise<void> {
  const { error } = await supabase.rpc("set_match_wager", {
    p_match_id: params.matchId,
    // De gegenereerde Args kennen geen nullable parameters; de RPC accepteert
    // null en leest dat als "inzet eraf".
    p_drink: params.drink as string,
    p_qty: params.drink ? (params.qty ?? 1) : undefined,
  });
  if (error) throw error;
  invalidateMatchData();
}

/** Vinkt de traktatie af aan de bar (#1004), of draait dat weer terug. Alleen
 *  op een afgeronde match met een winnaar — bij gelijkspel vervalt de inzet en
 *  weigert de RPC. */
export async function settleMatchWager(params: {
  matchId: string;
  settled?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("settle_match_wager", {
    p_match_id: params.matchId,
    p_settled: params.settled ?? true,
  });
  if (error) throw error;
  invalidateMatchData();
}

/**
 * De uitslag stond er al toen we hem wilden zetten.
 *
 * Een eigen klasse en geen kale Error (#1271), omdat de betekenis verschilt per
 * kant: voor wie het nú probeert is het een melding ("iemand was je voor"), maar
 * voor de offline-wachtrij is het juist een *succes* — de match is afgerond, en
 * dat is wat het item wilde bereiken. Zonder dit onderscheid dropt de outbox
 * hem als "poison item" en meldt hij een fout die er geen is.
 */
export class UitslagAlIngevuld extends Error {
  constructor() {
    super("Deze uitslag is al door iemand anders ingevuld.");
    this.name = "UitslagAlIngevuld";
  }
}

/** Zet het resultaat van een bestaande (geplande) match. winnerTeamId null = gelijkspel.
 *  Mag door de aanmaker, de deelnemers en de eigenaar van de groep waarin de
 *  match hangt (RLS), en alleen op een nog niet afgeronde match: als iemand
 *  anders net eerder opsloeg, faalt dit met een duidelijke melding i.p.v. stil
 *  te overschrijven.
 *
 *  played_at (#1271): een geplande match draagt zijn *speeltijd* al in deze
 *  kolom — er is geen aparte scheduled_at. Overschrijven met now() zou de match
 *  bij het invullen naar een andere kalenderdag verplaatsen, waardoor hij van
 *  zijn speeldagpagina verdwijnt (matchesVoorSpeeldag) en de per-ronde
 *  starttijden uit #827 sneuvelen. Geef daarom playedAt mee: de geplande tijd
 *  blijft dan staan. Alleen een match zonder tijdstip valt terug op now().
 */
export async function setMatchResult(params: {
  matchId: string;
  winnerTeamId: string | null;
  scoreA?: number | null;
  scoreB?: number | null;
  setScores?: SetScore[] | null;
  courtType?: CourtType | null;
  /** De geplande speeltijd van de match; null/weglaten = nu. */
  playedAt?: string | null;
}): Promise<void> {
  const patch: TablesUpdate<"matches"> = {
    status: "completed",
    winner_team_id: params.winnerTeamId,
    score_a: params.scoreA ?? null,
    score_b: params.scoreB ?? null,
    set_scores: params.setScores ?? null,
    played_at: params.playedAt ?? new Date().toISOString(),
  };
  // Alleen aanraken als expliciet meegegeven, zodat een bij het plannen gekozen
  // baantype niet gewist wordt wanneer de uitslag zonder baan-keuze binnenkomt.
  if (params.courtType !== undefined) patch.court_type = params.courtType;
  const { data, error } = await supabase
    .from("matches")
    .update(patch)
    .eq("id", params.matchId)
    .neq("status", "completed")
    .select("id");
  if (error) throw error;
  invalidateMatchData();
  if (!data || data.length === 0) {
    // RLS blokkeert een UPDATE zonder fout maar met 0 rijen — dat kan hier
    // zowel "al afgerond" als "geen rechten" betekenen. Haal de match op
    // (publiek leesbaar) om de juiste melding te kiezen.
    const { data: current } = await supabase
      .from("matches")
      .select("status")
      .eq("id", params.matchId)
      .maybeSingle();
    if (!current) throw new Error("Deze match bestaat niet meer.");
    if (current.status === "completed") throw new UitslagAlIngevuld();
    throw new Error(
      "Je kunt deze uitslag niet invullen — alleen de spelers van deze match, de aanmaker of de eigenaar van de groep mogen dat."
    );
  }
}

/** Koppelt een match achteraf aan een groep, verhangt hem, of maakt hem weer
 *  groepsloos (null) via de SECURITY DEFINER RPC (#648). De RPC eist
 *  lidmaatschap van de doelgroep, en bij verhangen/loskoppelen ook van de
 *  huidige groep. */
export async function setMatchGroup(
  matchId: string,
  groupId: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("set_match_group", {
    p_match_id: matchId,
    p_group_id: groupId ?? undefined,
  });
  if (error) throw error;
  invalidateMatchData();
}

/** Vervangt in één match een gastdeelnemer door de speler die er écht stond
 *  (#681). Voor het geval één gastprofiel voor meerdere personen gebruikt is.
 *  De RPC eist dat je de match aanmaakte of de groep bezit, dat de vervangen
 *  speler een gast is, en dat de vervanger nog niet meespeelt. De ratings
 *  worden serverzijdig herberekend. */
export async function replaceMatchPlayer(
  matchId: string,
  fromPlayerId: string,
  toPlayerId: string,
): Promise<void> {
  const { error } = await supabase.rpc("replace_match_player", {
    p_match_id: matchId,
    p_from_player: fromPlayerId,
    p_to_player: toPlayerId,
  });
  if (error) throw error;
  invalidateMatchData();
}

/**
 * Corrigeert de eindscore van een reeds afgeronde match. De aanmaker en de
 * eigenaar van de groep mogen dit (RLS, #978). Anders dan setMatchResult blijft
 * played_at behouden — het is een correctie, geen nieuwe uitslag. De winnaar
 * volgt uit de score.
 */
export async function updateMatchScore(params: {
  matchId: string;
  winnerTeamId: string | null;
  scoreA: number;
  scoreB: number;
  /** Optioneel: laat weg om de bestaande set-stand te behouden; null wist hem. */
  setScores?: SetScore[] | null;
}): Promise<void> {
  const patch: TablesUpdate<"matches"> = {
    winner_team_id: params.winnerTeamId,
    score_a: params.scoreA,
    score_b: params.scoreB,
  };
  // Alleen aanraken als expliciet meegegeven, zodat een score-correctie zonder
  // set-invoer de bestaande set-stand niet per ongeluk wist.
  if (params.setScores !== undefined) patch.set_scores = params.setScores;
  // .select() erbij zodat een door RLS geweigerde correctie niet als succes
  // langskomt: zonder select geeft PostgREST geen fout én geen rijen, en toonde
  // de UI vrolijk "Score bijgewerkt." terwijl er niets veranderde. Sinds #978
  // is de kring die hieraan mag groter, dus is die stilte duurder.
  const { data, error } = await supabase
    .from("matches")
    .update(patch)
    .eq("id", params.matchId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "Je kunt deze uitslag niet aanpassen — alleen wie hem invoerde of de beheerder van de groep mag dat.",
    );
  }
  invalidateMatchData();
}

/** Verplaatst een geplande match naar een ander tijdstip (of wist het tijdstip
 *  met null). Alleen de aanmaker mag dit (RLS). */
export async function updatePlannedMatchTime(params: {
  matchId: string;
  playedAt: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({ played_at: params.playedAt })
    .eq("id", params.matchId)
    .neq("status", "completed");
  if (error) throw error;
  invalidateMatchData();
}

/** Verwijdert een niet-afgeronde match via de SECURITY DEFINER RPC (alleen de
 *  aanmaker; een afgeronde match kan niet weg — dat zou stand/ratings raken). */
export async function deleteMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_match", {
    p_match_id: matchId,
  });
  if (error) throw error;
  invalidateMatchData();
}

/** "Alice & Bob" op basis van een team en de profielen-map; bij een
 *  singles-team (1v1) alleen "Alice". */
export function teamLabel(
  team: Team | undefined,
  profiles: Record<string, Profile>,
): string {
  if (!team) return "Onbekend team";
  if (team.name) return team.name;
  if (!team.player2_id) return displayName(profiles[team.player1_id]);
  return `${displayName(profiles[team.player1_id])} & ${displayName(profiles[team.player2_id])}`;
}
