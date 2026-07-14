// Web-push aan/uit vanuit de instellingen. De publieke VAPID-sleutel komt
// uit de build-omgeving; de Edge Function send-push bezorgt de meldingen.

import { supabase } from "@/lib/supabase/client";

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** Kan dit apparaat push ontvangen (en is de app ervoor geconfigureerd)? */
export function pushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    !!PUBLIC_KEY
  );
}

/** VAPID-sleutel (base64url) → bytes voor pushManager.subscribe. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/** Vraagt toestemming, abonneert dit apparaat en registreert het endpoint. */
export async function enablePush(userId: string): Promise<void> {
  if (!pushSupported() || !PUBLIC_KEY) {
    throw new Error("Meldingen worden hier niet ondersteund.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Meldingen zijn geweigerd — zet ze aan in je browserinstellingen.");
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY).buffer as ArrayBuffer,
  });
  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

/** Meldt dit apparaat af en verwijdert het endpoint uit de databank. */
export async function disablePush(): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription) return;
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}
