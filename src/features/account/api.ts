import { supabase } from "@/lib/supabase/client";
import { getProfile } from "@/features/profiles/api";
import { getPlayerMatches } from "@/features/matches/api";
import { getMyFriendships } from "@/features/friends/api";
import { getMyGroups } from "@/features/groups/api";
import { invalidate } from "@/lib/supabase/queryCache";
import type { RoastIntensiteit } from "@/types";

/** Privacy-instellingen van het profiel (kolommen uit migratie 20260707162000,
 *  roast_schild uit 20260711202439, roast_intensiteit uit 20260712223224). */
export interface Privacy {
  /** Verschijn je in het zoeken naar spelers? */
  discoverable: boolean;
  /** Mogen anderen je een vriendschapsverzoek sturen? */
  allow_friend_requests: boolean;
  /** Roast-schild (#183): aan → het systeem roast je niet meer (neutrale
   *  variant overal). Default 'false' = schild neer. */
  roast_schild: boolean;
  /** Persoonlijke roast-intensiteit (#183) voor je eigen feed en dashboard, los
   *  van de per-groep instelling van een eigenaar. Default 'gemeen'. Het schild
   *  overrulet dit: staat het aan, dan geen spot ongeacht de intensiteit. */
  roast_intensiteit: RoastIntensiteit;
}

/** Haalt de privacy-instellingen van de gebruiker op (default = alles open). */
export async function getPrivacy(userId: string): Promise<Privacy> {
  const { data, error } = await supabase
    .from("profiles")
    .select("discoverable, allow_friend_requests, roast_schild, roast_intensiteit")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    discoverable: data?.discoverable ?? true,
    allow_friend_requests: data?.allow_friend_requests ?? true,
    roast_schild: data?.roast_schild ?? false,
    roast_intensiteit: data?.roast_intensiteit ?? "radioactief",
  };
}

/** Schrijft de privacy-instellingen weg. */
export async function updatePrivacy(
  userId: string,
  patch: Partial<Privacy>,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) throw error;
  // De zoekresultaten in Vrienden hangen van 'discoverable' af.
  invalidate("profiles");
}

/** Notificatie-voorkeuren (#57): per push-type aan/uit (kolommen uit migratie
 *  20260717120000). Server-side gerespecteerd door de edge functions send-push
 *  en match-reminders; gelden dus voor ál je apparaten. */
export interface NotificationPrefs {
  /** Nieuwe ronde gegenereerd — jouw match staat klaar. */
  notify_new_round: boolean;
  /** Uitslag van jouw match ingevoerd. */
  notify_result: boolean;
  /** Nieuw vriendschapsverzoek. */
  notify_friend_request: boolean;
  /** Herinnering enkele uren vóór een geplande match. */
  notify_match_reminder: boolean;
  /** Promotie/degradatie in het groepsklassement (#302). */
  notify_rank_change: boolean;
  /** Alles rond een speeldag-poll (#1273): nieuwe poll, laatste kans, gekozen
   *  moment, geboekte baan, afgelasting, de dag zelf en de por van een
   *  groepslid. Zeven van de negentien verstuurmomenten. */
  notify_poll: boolean;
  /** De VAR: een betwist punt en de uitspraak erover (#1273). */
  notify_var: boolean;
  /** Stille uren (#1273), in clubtijd. Null = geen stille uren. */
  notify_stil_van: string | null;
  notify_stil_tot: string | null;
}

/** Haalt de notificatie-voorkeuren op (default = alles aan). */
export async function getNotificationPrefs(
  userId: string,
): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "notify_new_round, notify_result, notify_friend_request, notify_match_reminder, notify_rank_change, notify_poll, notify_var, notify_stil_van, notify_stil_tot",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    notify_new_round: data?.notify_new_round ?? true,
    notify_result: data?.notify_result ?? true,
    notify_friend_request: data?.notify_friend_request ?? true,
    notify_match_reminder: data?.notify_match_reminder ?? true,
    notify_rank_change: data?.notify_rank_change ?? true,
    notify_poll: data?.notify_poll ?? true,
    notify_var: data?.notify_var ?? true,
    // Standaard aan (23:00–07:30), net als de kolomdefault: de nachtelijke push
    // is geen keuze die iemand ooit gemaakt heeft.
    notify_stil_van: data?.notify_stil_van ?? "23:00",
    notify_stil_tot: data?.notify_stil_tot ?? "07:30",
  };
}

/** Schrijft de notificatie-voorkeuren weg. */
export async function updateNotificationPrefs(
  userId: string,
  patch: Partial<NotificationPrefs>,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) throw error;
}

/** Wijzigt het e-mailadres. Supabase stuurt een bevestigingsmail. */
export async function changeEmail(newEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
  if (error) throw error;
}

/**
 * Wijzigt het wachtwoord, maar alleen als het huidige wachtwoord klopt.
 * We verifiëren dat door opnieuw in te loggen met het huidige wachtwoord.
 */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) throw new Error("Je huidige wachtwoord klopt niet.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Alles wat de app over jou bewaart, als één object (#921).
 *
 * Bewust client-side samengesteld uit de bestaande api-functies: RLS bepaalt al
 * precies wat jij mag zien, dus een aparte export-RPC zou dezelfde regels nóg
 * een keer moeten formuleren — en dan kunnen ze uit elkaar lopen.
 */
export async function exporteerMijnGegevens(userId: string) {
  const [profiel, privacy, meldingen, matches, vriendschappen, groepen] =
    await Promise.all([
      getProfile(userId),
      getPrivacy(userId),
      getNotificationPrefs(userId),
      getPlayerMatches(userId, 1000),
      getMyFriendships(),
      getMyGroups(),
    ]);

  return {
    geexporteerdOp: new Date().toISOString(),
    profiel,
    privacy,
    meldingen,
    matches,
    vriendschappen,
    groepen,
  };
}
