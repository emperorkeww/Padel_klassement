import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/types";

/** Alle profielen (publiek leesbaar); handig als lookup-map. */
export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("username", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProfilesMap(): Promise<Record<string, Profile>> {
  const list = await getAllProfiles();
  return Object.fromEntries(list.map((p) => [p.id, p]));
}

/** Zoek spelers op username (voor vrienden toevoegen). */
export async function searchProfiles(
  query: string,
  excludeId: string,
): Promise<Profile[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", `%${q}%`)
    .neq("id", excludeId)
    .order("username", { ascending: true })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

// Accepteert elke rij met username/full_name (Profile, PlayerStanding, ...).
export async function updateProfile(
  id: string,
  patch: { username?: string; full_name?: string | null; avatar_url?: string | null },
): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

/** Uploadt een profielfoto naar de 'avatars'-bucket en geeft de publieke URL terug. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || undefined,
    });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-buster zodat een nieuwe foto meteen zichtbaar is.
  return `${data.publicUrl}?v=${Date.now()}`;
}

export function displayName(
  p: { username: string; full_name: string | null } | undefined | null,
): string {
  if (!p) return "Onbekend";
  return p.full_name?.trim() || p.username;
}
