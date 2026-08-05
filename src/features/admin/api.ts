import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import { errorMessage } from "@/lib/utils/errors";
import type {
  AdminAuditRegel,
  AdminDetail,
  AdminGast,
  AdminGebruiker,
  AdminGroep,
} from "./types";

// Clientkant van het adminpaneel (#1036). Eén ingang: de edge function
// `admin-users`. Er staat hier bewust geen enkele directe tabel- of RPC-query —
// app_admins en admin_audit_log hebben geen client-grant, en de overzichts-RPC's
// zijn service-role-only. Wie hier een `supabase.from(...)` toevoegt, krijgt
// een 42501 en heeft het ontwerp gemist.

/**
 * Roept de edge function aan en vertaalt een foutstatus naar de Nederlandse
 * melding die de function meestuurt.
 *
 * functions.invoke levert bij een non-2xx een FunctionsHttpError waarin het
 * antwoord als Response in `context` zit; zonder dit uitpakken houd je
 * "Edge Function returned a non-2xx status code" over en zie je nooit dat er
 * gewoon "Geen toegang" stond.
 */
async function roepAdmin<T>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("admin-users", {
    body: { action, ...params },
  });
  if (error) throw new Error(await foutTekst(error));
  if (data == null) throw new Error("Leeg antwoord van de server");
  return data;
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
