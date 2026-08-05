import { supabase } from "@/lib/supabase/client";

// Dunne wrappers rond supabase.auth, zodat alle auth-data-access — net als de
// overige features — via een api.ts loopt. Puur doorgeefluik: geen extra logica.

export const getSession = () => supabase.auth.getSession();

export const onAuthStateChange: typeof supabase.auth.onAuthStateChange = (cb) =>
  supabase.auth.onAuthStateChange(cb);

/** Zoekt of een username al bestaat (case-insensitief), voor de signup-check. */
export const findProfileByUsername = (username: string) =>
  supabase.from("profiles").select("id").ilike("username", username).limit(1);

export const signOut = () => supabase.auth.signOut();

export const signInWithPassword = (
  credentials: Parameters<typeof supabase.auth.signInWithPassword>[0],
) => supabase.auth.signInWithPassword(credentials);

export const signUp = (
  credentials: Parameters<typeof supabase.auth.signUp>[0],
) => supabase.auth.signUp(credentials);

export const resetPasswordForEmail = (
  ...args: Parameters<typeof supabase.auth.resetPasswordForEmail>
) => supabase.auth.resetPasswordForEmail(...args);

export const updateUser = (
  ...args: Parameters<typeof supabase.auth.updateUser>
) => supabase.auth.updateUser(...args);

/** Verzilvert een e-mail-OTP (bv. het `token_hash` uit een herstel-link die het
 *  adminpaneel uitdeelde, #1036) en levert bij succes een sessie op. */
export const verifyOtp = (
  ...args: Parameters<typeof supabase.auth.verifyOtp>
) => supabase.auth.verifyOtp(...args);
