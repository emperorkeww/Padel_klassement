import { supabase } from "../../lib/supabase";
import { invalidate } from "../../lib/queryCache";

/** Privacy-instellingen van het profiel (kolommen uit migratie 20260707162000). */
export interface Privacy {
  /** Verschijn je in het zoeken naar spelers? */
  discoverable: boolean;
  /** Mogen anderen je een vriendschapsverzoek sturen? */
  allow_friend_requests: boolean;
}

/** Haalt de privacy-instellingen van de gebruiker op (default = alles open). */
export async function getPrivacy(userId: string): Promise<Privacy> {
  // select("*") i.p.v. de kolomnamen: database.types.ts kent 'discoverable' en
  // 'allow_friend_requests' nog niet, dus lezen we ze via een cast van de rij.
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    discoverable: (row.discoverable as boolean | undefined) ?? true,
    allow_friend_requests:
      (row.allow_friend_requests as boolean | undefined) ?? true,
  };
}

/** Schrijft de privacy-instellingen weg. */
export async function updatePrivacy(
  userId: string,
  patch: Partial<Privacy>,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    // Cast: kolommen bestaan wel in de databank, nog niet in database.types.ts.
    .update(patch as never)
    .eq("id", userId);
  if (error) throw error;
  // De zoekresultaten in Vrienden hangen van 'discoverable' af.
  invalidate("profiles");
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
