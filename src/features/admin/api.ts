import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import { errorMessage } from "@/lib/utils/errors";
import { invalidateMatchData } from "@/features/matches/api";
import type {
  AdminAuditRegel,
  AdminDetail,
  AdminGast,
  AdminGebruiker,
  AdminGroep,
  AdminGroepLid,
  AdminMatch,
  AdminPoll,
  AppInstelling,
  FoutGroep,
  SysteemStatus,
} from "./types";

// Clientkant van het adminpaneel (#1036, #1159). Twee ingangen, allebei een edge
// function: `admin-users` voor accounts en `admin-content` voor de inhoud
// (matches, groepen, polls). Er staat hier bewust geen enkele directe tabel- of
// RPC-query — app_admins en admin_audit_log hebben geen client-grant, en de
// overzichts-RPC's zijn service-role-only. Wie hier een `supabase.from(...)`
// toevoegt, krijgt een 42501 en heeft het ontwerp gemist.

/**
 * Roept een van de twee beheerfuncties aan en vertaalt een foutstatus naar de
 * Nederlandse melding die de function meestuurt.
 *
 * functions.invoke levert bij een non-2xx een FunctionsHttpError waarin het
 * antwoord als Response in `context` zit; zonder dit uitpakken houd je
 * "Edge Function returned a non-2xx status code" over en zie je nooit dat er
 * gewoon "Geen toegang" stond.
 */
async function roep<T>(
  functie: "admin-users" | "admin-content",
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(functie, {
    body: { action, ...params },
  });
  if (error) throw new Error(await foutTekst(error));
  if (data == null) throw new Error("Leeg antwoord van de server");
  return data;
}

function roepAdmin<T>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  return roep<T>("admin-users", action, params);
}

function roepInhoud<T>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  return roep<T>("admin-content", action, params);
}

async function foutTekst(error: unknown): Promise<string> {
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (typeof body.error === "string" && body.error) return body.error;
    } catch {
      // Geen JSON-body (bv. een gateway-fout): val terug op de melding zelf.
    }
  }
  return errorMessage(error);
}

/**
 * Is de ingelogde gebruiker beheerder? De enige actie die ook voor een
 * niet-beheerder antwoordt — het menu-item moet immers beslist kunnen worden.
 *
 * Vijf minuten gecachet per sessie: dit draait op elke paginalading van elke
 * gebruiker, en het antwoord verandert vrijwel nooit. Wie tijdens een sessie
 * beheerder wordt, ziet het item na een herlaadbeurt.
 */
export function whoami(): Promise<boolean> {
  return cached(
    "admin:whoami",
    async () => (await roepAdmin<{ admin: boolean }>("whoami")).admin,
    5 * 60_000,
  );
}

export function lijstGebruikers(): Promise<AdminGebruiker[]> {
  return cached(
    "admin:users",
    async () => (await roepAdmin<{ users: AdminGebruiker[] }>("list_users")).users,
    30_000,
  );
}

export function gebruikerDetail(userId: string): Promise<AdminDetail> {
  return cached(
    `admin:detail:${userId}`,
    async () =>
      (await roepAdmin<{ detail: AdminDetail }>("user_detail", { user_id: userId }))
        .detail,
    30_000,
  );
}

/** Na een muterende actie (PR 2): gooi alles van het paneel weg, niet de rest
 *  van de app. `admin:whoami` valt hier bewust ook onder — wordt er een
 *  beheerder bijgezet, dan klopt de cache van die sessie niet meer. */
export function verversAdmin(): void {
  invalidate("admin:");
}

// ---- Muterende acties (#1036 deel 2) ---------------------------------------
//
// Geen van deze functies cachet: het antwoord is eenmalig (een link, een
// wachtwoord) of het effect zit elders. Ze verversen wel het paneel, zodat de
// lijst en het auditspoor meteen kloppen.

/** Genereert een eenmalige herstel-link naar /reset-wachtwoord. */
export async function herstelLink(
  userId: string,
): Promise<{ link: string; vervalt_over_minuten: number }> {
  const uit = await roepAdmin<{ link: string; vervalt_over_minuten: number }>(
    "recovery_link",
    { user_id: userId },
  );
  verversAdmin();
  return uit;
}

/** Zet een tijdelijk wachtwoord en dwingt een wissel af bij de volgende login.
 *  Het wachtwoord komt hier één keer langs en wordt nergens bewaard. */
export async function tijdelijkWachtwoord(userId: string): Promise<string> {
  const { wachtwoord } = await roepAdmin<{ wachtwoord: string }>("temp_password", {
    user_id: userId,
  });
  verversAdmin();
  return wachtwoord;
}

/** Stuurt de gewone herstelmail opnieuw. Vangnet, geen hoofdweg: de ingebouwde
 *  SMTP is stevig gerate-limit. */
export async function herstelmailOpnieuw(userId: string): Promise<void> {
  await roepAdmin<{ ok: true }>("resend_reset", { user_id: userId });
  verversAdmin();
}

/** Corrigeert een verkeerd ingetikt e-mailadres en bevestigt het meteen. */
export async function corrigeerEmail(userId: string, email: string): Promise<void> {
  await roepAdmin<{ ok: true }>("fix_email", { user_id: userId, email });
  verversAdmin();
}

/** Trekt alle sessies van een gebruiker in. */
export async function trekSessiesIn(userId: string): Promise<number> {
  const { sessies } = await roepAdmin<{ ok: true; sessies: number }>("sign_out_all", {
    user_id: userId,
  });
  verversAdmin();
  return sessies;
}

export function auditVoor(userId: string): Promise<AdminAuditRegel[]> {
  return cached(
    `admin:audit:${userId}`,
    async () =>
      (await roepAdmin<{ regels: AdminAuditRegel[] }>("audit_log", { user_id: userId }))
        .regels,
    30_000,
  );
}

/** Verwijdert een account definitief. `username` moet exact kloppen; de edge
 *  function controleert dat zelf opnieuw — de dialoog is ergonomie, de
 *  servercheck is de grendel. */
export async function verwijderAccount(
  userId: string,
  username: string,
): Promise<{ groepen_zonder_eigenaar: number }> {
  const uit = await roepAdmin<{ ok: true; groepen_zonder_eigenaar: number }>(
    "delete_user",
    { user_id: userId, username },
  );
  verversAdmin();
  return uit;
}

export function lijstGasten(): Promise<AdminGast[]> {
  return cached(
    "admin:gasten",
    async () => (await roepAdmin<{ gasten: AdminGast[] }>("list_guests")).gasten,
    30_000,
  );
}

export function lijstGroepen(): Promise<AdminGroep[]> {
  return cached(
    "admin:groepen",
    async () => (await roepAdmin<{ groepen: AdminGroep[] }>("list_groups")).groepen,
    30_000,
  );
}

// ---- Inhoud: matches, groepen en polls (#1159) ------------------------------
//
// Alles hieronder loopt via `admin-content`. Na een mutatie wordt níet alleen
// het paneel ververst maar ook de gewone matchcache: corrigeert de beheerder
// een uitslag terwijl hij zelf in die groep zit, dan moet zijn eigen
// matchoverzicht meteen kloppen in plaats van tot de volgende reload te liegen.

export type MatchFilter = {
  groupId?: string | null;
  /** ISO-grenzen; `tot` is exclusief. */
  van?: string | null;
  tot?: string | null;
  status?: string | null;
  zoek?: string;
  limiet?: number;
};

export function lijstMatches(
  filter: MatchFilter = {},
): Promise<{ matches: AdminMatch[]; totaal: number }> {
  const sleutel = [
    filter.groupId ?? "",
    filter.van ?? "",
    filter.tot ?? "",
    filter.status ?? "",
    filter.zoek ?? "",
    filter.limiet ?? "",
  ].join("|");
  return cached(
    `admin:matches:${sleutel}`,
    () =>
      roepInhoud<{ matches: AdminMatch[]; totaal: number }>("list_matches", {
        group_id: filter.groupId ?? null,
        van: filter.van ?? null,
        tot: filter.tot ?? null,
        status: filter.status ?? null,
        zoek: filter.zoek ?? null,
        limiet: filter.limiet,
      }),
    30_000,
  );
}

/** Verversen na een inhoudsmutatie: het paneel én de gewone matchcache. */
function verversNaMutatie(): void {
  invalidate("admin:");
  invalidateMatchData();
}

export async function corrigeerUitslag(params: {
  matchId: string;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
  /** Laat weg om de bestaande set-stand te behouden; null wist hem. */
  setScores?: unknown[] | null;
  /** Alleen meegeven als de status mee moet veranderen (bv. een geplande match
   *  die alsnog afgerond wordt). Impliciet afronden doet de function niet. */
  status?: string;
}): Promise<void> {
  await roepInhoud<{ ok: true }>("update_match_score", {
    match_id: params.matchId,
    score_a: params.scoreA,
    score_b: params.scoreB,
    winner_team_id: params.winnerTeamId,
    ...(params.setScores !== undefined ? { set_scores: params.setScores } : {}),
    ...(params.status !== undefined ? { status: params.status } : {}),
  });
  verversNaMutatie();
}

export async function verplaatsMatch(
  matchId: string,
  playedAt: string | null,
): Promise<void> {
  await roepInhoud<{ ok: true }>("move_match", {
    match_id: matchId,
    played_at: playedAt,
  });
  verversNaMutatie();
}

/** Vervangt als beheerder één speler in een match (#1327). Anders dan
 *  `replaceMatchPlayer()` uit features/matches vraagt dit geen lidmaatschap van
 *  de groep — de beheerder zit er per definitie niet in — en legt het de
 *  opstelling vóór en ná vast in het logboek. */
export async function vervangSpelerAlsBeheerder(params: {
  matchId: string;
  vanSpeler: string;
  naarSpeler: string;
}): Promise<void> {
  await roepInhoud<{ ok: true }>("replace_match_player", {
    match_id: params.matchId,
    from_player: params.vanSpeler,
    to_player: params.naarSpeler,
  });
  verversNaMutatie();
}

/** Ruilt als beheerder twee spelers van plek (#1327). Dezelfde match aan beide
 *  kanten betekent "van team wisselen"; twee matches betekent "ruilen tussen
 *  twee banen". */
export async function ruilSpelersAlsBeheerder(params: {
  matchA: string;
  spelerA: string;
  matchB: string;
  spelerB: string;
}): Promise<void> {
  await roepInhoud<{ ok: true }>("swap_match_players", {
    match_id: params.matchA,
    player_a: params.spelerA,
    match_b: params.matchB,
    player_b: params.spelerB,
  });
  verversNaMutatie();
}

/** Verwijdert een match als beheerder — anders dan `deleteMatch()` uit
 *  features/matches ook een afgeronde. De ratings worden door de triggers
 *  herberekend. */
export async function verwijderMatchAlsBeheerder(matchId: string): Promise<void> {
  await roepInhoud<{ ok: true }>("delete_match", { match_id: matchId });
  verversNaMutatie();
}

export function lijstPolls(groupId?: string | null): Promise<AdminPoll[]> {
  return cached(
    `admin:polls:${groupId ?? ""}`,
    async () =>
      (await roepInhoud<{ polls: AdminPoll[] }>("list_polls", {
        group_id: groupId ?? null,
      })).polls,
    30_000,
  );
}

export async function zetPollStatus(
  pollId: string,
  status: "open" | "cancelled",
): Promise<void> {
  await roepInhoud<{ ok: true }>("set_poll_status", {
    poll_id: pollId,
    status,
  });
  verversNaMutatie();
}

export async function verwijderPoll(pollId: string): Promise<void> {
  await roepInhoud<{ ok: true }>("delete_poll", { poll_id: pollId });
  verversNaMutatie();
}

export function lijstGroepLeden(groupId: string): Promise<AdminGroepLid[]> {
  return cached(
    `admin:leden:${groupId}`,
    async () =>
      (await roepInhoud<{ leden: AdminGroepLid[] }>("list_group_members", {
        group_id: groupId,
      })).leden,
    30_000,
  );
}

/** Wijst een nieuwe eigenaar aan. De server eist dat het een lid is en geen
 *  gast, en zet `groups.created_by` én `group_members.role` in één keer. */
export async function wijsEigenaarAan(
  groupId: string,
  userId: string,
): Promise<void> {
  await roepInhoud<{ ok: true }>("set_group_owner", {
    group_id: groupId,
    user_id: userId,
  });
  verversNaMutatie();
}

export async function verwijderGroepslid(
  groupId: string,
  userId: string,
): Promise<void> {
  await roepInhoud<{ ok: true }>("remove_group_member", {
    group_id: groupId,
    user_id: userId,
  });
  verversNaMutatie();
}

/** `naam` moet exact kloppen; de function controleert dat zelf opnieuw. */
export async function verwijderGroep(
  groupId: string,
  naam: string,
): Promise<{ matches_losgekoppeld: number }> {
  const uit = await roepInhoud<{ ok: true; matches_losgekoppeld: number }>(
    "delete_group",
    { group_id: groupId, naam },
  );
  verversNaMutatie();
  return uit;
}

/** Het volledige logboek, nieuwste eerst — los van één gebruiker. */
export function auditRecent(limiet = 100): Promise<AdminAuditRegel[]> {
  return cached(
    `admin:audit:recent:${limiet}`,
    async () =>
      (await roepInhoud<{ regels: AdminAuditRegel[] }>("audit_recent", { limiet }))
        .regels,
    30_000,
  );
}

// ---- Systeemgezondheid (#1049) ---------------------------------------------

/**
 * Draait alles nog? Eén antwoord uit drie bronnen: de databank (cron-jobs,
 * rijtellingen, laatste migratie, push), de projectbrede secrets — die alleen
 * een edge function kan zien — en het functiemanifest uit de repo.
 *
 * Korte cache: dit is een dashboard dat je openslaat om te kíjken, dus een
 * versie van tien seconden oud is prima, maar een minuut is te lang als je
 * naast iemand staat die net een secret heeft gezet.
 */
export function systeemStatus(): Promise<SysteemStatus> {
  return cached(
    "admin:systeem",
    () => roepAdmin<SysteemStatus>("system_status"),
    10_000,
  );
}

// ---- Foutenlogboek (#1049) -------------------------------------------------

/**
 * Crashmeldingen uit de browser, gegroepeerd op boodschap + scope.
 *
 * Gegroepeerd en niet als losse rijen: één kapotte route levert honderden
 * identieke meldingen op, en als lijst verbergt dat juist de tweede, zeldzamere
 * fout die er misschien echt toe doet.
 */
export function foutenLogboek(dagen = 7): Promise<FoutGroep[]> {
  return cached(
    `admin:fouten:${dagen}`,
    async () =>
      (await roepAdmin<{ groepen: FoutGroep[] }>("client_errors", { dagen }))
        .groepen,
    30_000,
  );
}

// ---- Schakelaars zonder deploy (#1049) -------------------------------------

export function lijstInstellingen(): Promise<AppInstelling[]> {
  return cached(
    "admin:instellingen",
    async () =>
      (await roepAdmin<{ instellingen: AppInstelling[] }>("list_settings"))
        .instellingen,
    30_000,
  );
}

/**
 * Zet een schakelaar om. Werkt zonder deploy — dat is het hele punt.
 *
 * `dagbudget` alleen meesturen als je het wilt wijzigen; null laat het staan.
 */
export async function zetInstelling(
  sleutel: string,
  aan: boolean,
  dagbudget?: number,
): Promise<void> {
  await roepAdmin<{ ok: true }>("set_setting", { sleutel, aan, dagbudget });
  verversAdmin();
}

// ---- Onderhoud en export (#1049) -------------------------------------------

/**
 * De onderdelen van de klassementketen, in de volgorde waarin de triggers op
 * `matches` ze zouden draaien. Ratings is een row-trigger en gaat voorop; de
 * rest volgt de alfabetische volgorde van de triggernamen.
 *
 * Wie deze volgorde omgooit, krijgt een klassement dat subtiel afwijkt van wat
 * een gewone matchwijziging zou opleveren.
 */
export const HERBEREKEN_STAPPEN = [
  { id: "ratings", label: "Elo-ratings" },
  { id: "pias", label: "Pias van de week" },
  { id: "rank_state", label: "Stijgers en dalers" },
  { id: "dictator", label: "Dictator-termijnen" },
  { id: "zwarte_piet", label: "Zwarte Piet" },
] as const;

export type HerberekenStap = (typeof HERBEREKEN_STAPPEN)[number]["id"];

/**
 * Herberekent één onderdeel. Eén per aanroep en niet alle vijf achter elkaar:
 * vijf volledige herberekeningen in één verzoek lopen tegen de tijdslimiet van
 * de edge function aan.
 *
 * Anders dan de dummy-update op `matches` die tot nu toe de enige route was,
 * raakt dit `matches` niet — en vuurt het dus geen push-webhooks af.
 */
export async function herbereken(
  wat: HerberekenStap,
): Promise<{ wat: string; duur_ms: number }> {
  const uit = await roepAdmin<{ wat: string; duur_ms: number }>("recompute", {
    wat,
  });
  verversAdmin();
  invalidateMatchData();
  return uit;
}

/** De volledige gegevensexport van een ánder account, als JSON. */
export async function exporteerGebruiker(
  userId: string,
): Promise<Record<string, unknown>> {
  const uit = await roepAdmin<{ export: Record<string, unknown> }>(
    "export_user",
    { user_id: userId },
  );
  verversAdmin();
  return uit.export;
}
