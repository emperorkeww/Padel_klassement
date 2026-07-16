// Web-push aan/uit vanuit de instellingen. De publieke VAPID-sleutel komt
// uit de build-omgeving; de Edge Function send-push bezorgt de meldingen.

import { supabase } from "@/lib/supabase/client";
import { isIos, isStandalone } from "@/lib/utils/pwa";

// Lazy gelezen zodat tests de env-variabele nog kunnen stubben.
const publicKey = () => import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** Kan dit apparaat push ontvangen (en is de app ervoor geconfigureerd)? */
export function pushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    !!publicKey()
  );
}

export type PushAvailability = "ready" | "needs-install" | "denied" | "unsupported";

/** Waarom kan push hier wel of niet? Stuurt de meldingen-kaart en -prompt aan:
 *  - "ready": schakelaar tonen;
 *  - "needs-install": iOS-browsertab — push werkt daar pas als de app op het
 *    beginscherm staat (installatie-instructie tonen);
 *  - "denied": permissie eerder geweigerd — alleen via systeeminstellingen
 *    terug te draaien;
 *  - "unsupported": deze browser kan het simpelweg niet. */
export function pushAvailability(): PushAvailability {
  if (pushSupported()) {
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      return "denied";
    }
    return "ready";
  }
  if (isIos() && !isStandalone()) return "needs-install";
  return "unsupported";
}

/** VAPID-sleutel (base64url) → bytes voor pushManager.subscribe. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const SW_READY_TIMEOUT_MS = 3000;

/** Wacht op de actieve service worker, maar nooit langer dan de timeout —
 *  `.ready` resolvet nooit als er geen SW geregistreerd is (zoals in dev),
 *  en dan bleef de UI eeuwig op "Controleren…" hangen (#412). */
async function readyRegistration(
  timeoutMs = SW_READY_TIMEOUT_MS,
): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;
  // Geen actieve SW (nog): main.tsx registreert pas ná het load-event, dus
  // geef `.ready` even de kans voordat we opgeven.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await readyRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/** Vraagt toestemming, abonneert dit apparaat en registreert het endpoint. */
export async function enablePush(userId: string): Promise<void> {
  const key = publicKey();
  if (!pushSupported() || !key) {
    throw new Error("Meldingen worden hier niet ondersteund.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Meldingen zijn geweigerd — zet ze aan via Instellingen → Meldingen (iPhone) of je browserinstellingen.",
    );
  }
  const registration = await readyRegistration();
  if (!registration) {
    throw new Error("Kon de meldingsdienst niet bereiken — herlaad de app en probeer opnieuw.");
  }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
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
