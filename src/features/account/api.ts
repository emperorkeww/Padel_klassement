import { supabase } from "../../lib/supabase";

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
