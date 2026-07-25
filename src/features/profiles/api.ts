import { supabase } from "@/lib/supabase/client";
import { cached, invalidate } from "@/lib/supabase/queryCache";
import { downscaleImage } from "@/lib/utils/image";
import type { Profile } from "@/types";

/** Alle profielen (publiek leesbaar); handig als lookup-map. */
export function getAllProfiles(): Promise<Profile[]> {
  return cached("profiles:all", async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("username", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
}

export function getProfile(id: string): Promise<Profile | null> {
  return cached(`profiles:one:${id}`, async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
}

/** Alleen de opgegeven profielen — voor pagina's met een handvol spelers. */
export function getProfilesByIds(
  ids: string[],
): Promise<Record<string, Profile>> {
  const wanted = [...new Set(ids)].sort();
  if (wanted.length === 0) return Promise.resolve({});
  return cached(`profiles:ids:${wanted.join(",")}`, async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", wanted);
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
  });
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
  patch: {
    username?: string;
    full_name?: string | null;
    avatar_url?: string | null;
    /** Cosmetische weergavevoorkeur (#542). */
    toon_waarnemend_dictator?: boolean;
    /** AI dictator-portret opt-out (#554). De gegenereerde URL/bron-kolommen
     *  zijn niet client-schrijfbaar (guard-trigger); alleen deze vlag. */
    dictator_portret?: boolean;
    /** AI pias-portret opt-out (#682) — zelfde afspraak als hierboven: enkel de
     *  vlag is client-schrijfbaar, en 'false' nult ook het bewaarde portret. */
    pias_portret?: boolean;
  },
): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
  // Namen/avatars zitten ook in de standings-views.
  invalidate("profiles", "standings");
}

/** Schrijft de uitgelichte badges (geordende lijst van badge-id's) weg voor de
 *  eigen gebruiker. De RLS-update-policy laat alleen het eigen profiel toe. */
export async function updateFeaturedBadges(
  userId: string,
  badgeIds: string[],
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ featured_badges: badgeIds })
    .eq("id", userId);
  if (error) throw error;
  invalidate("profiles");
}

/** Uploadt een profielfoto naar de 'avatars'-bucket en geeft de publieke URL terug.
 *  De foto wordt eerst client-side verkleind (256px, WebP); lukt dat niet
 *  (oude browser), dan gaat het origineel omhoog. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  let blob: Blob = file;
  let ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  try {
    const processed = await downscaleImage(file);
    blob = processed.blob;
    ext = processed.ext;
  } catch {
    /* verkleinen mislukt — origineel uploaden is prima als terugval */
  }

  const filename = `avatar.${ext}`;
  const path = `${userId}/${filename}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, {
      upsert: true,
      // Een jaar cachen mag: de URL krijgt bij elke nieuwe upload een verse
      // ?v=-cachebuster, dus stale avatars bestaan niet.
      cacheControl: "31536000",
      contentType: blob.type || undefined,
    });
  if (error) throw error;

  // Ruim eerdere avatarbestanden op (bv. avatar.jpg bij een nieuwe .png),
  // zodat er geen orphan-bestanden achterblijven.
  const { data: existing } = await supabase.storage.from("avatars").list(userId);
  const stale = (existing ?? [])
    .filter((o) => o.name !== filename)
    .map((o) => `${userId}/${o.name}`);
  if (stale.length > 0) {
    await supabase.storage.from("avatars").remove(stale);
  }

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
