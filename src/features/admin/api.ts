import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import { errorMessage } from "@/lib/utils/errors";
import type { AdminDetail, AdminGebruiker } from "./types";

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
