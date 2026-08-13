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
  await bewaarAbonnement(userId, subscription);
}

/** Het abonnement wegschrijven. Apart, omdat de zelfheling hieronder hetzelfde
 *  doet zonder opnieuw toestemming te vragen. */
async function bewaarAbonnement(
  userId: string,
  subscription: PushSubscription,
): Promise<void> {
  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      // Voor de apparatenlijst (#1273): een endpoint is een capability-URL van
      // tweehonderd tekens en zegt een mens niets.
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

/**
 * Een leesbare naam voor een abonnement (#1273).
 *
 * De user-agent is er sinds deze issue; oudere rijen hebben hem niet, en dan
 * valt hij terug op de push-dienst in het endpoint — grof, maar het scheelt
 * "welke van deze drie is mijn telefoon?".
 */
export function apparaatNaam(ua: string | null, endpoint: string): string {
  const bron = ua ?? "";
  const platform = /iPhone|iPad|iOS/i.test(bron)
    ? "iPhone"
    : /Android/i.test(bron)
      ? "Android"
      : /Macintosh|Mac OS/i.test(bron)
        ? "Mac"
        : /Windows/i.test(bron)
          ? "Windows"
          : /Linux/i.test(bron)
            ? "Linux"
            : "";
  // Edge en Samsung Internet noemen zichzelf óók Chrome; volgorde is dus niet
  // willekeurig.
  const browser = /Edg\//.test(bron)
    ? "Edge"
    : /SamsungBrowser/.test(bron)
      ? "Samsung Internet"
      : /OPR\//.test(bron)
        ? "Opera"
        : /Firefox/.test(bron)
          ? "Firefox"
          : /Chrome/.test(bron)
            ? "Chrome"
            : /Safari/.test(bron)
              ? "Safari"
              : "";
  if (browser || platform) return [browser, platform].filter(Boolean).join(" op ");
  // Geen user-agent: dan maar de dienst waar de push langs zou gaan.
  try {
    const host = new URL(endpoint).hostname;
    if (host.includes("fcm.googleapis")) return "Chrome of Android";
    if (host.includes("push.apple")) return "Apple-toestel";
    if (host.includes("mozilla")) return "Firefox";
    if (host.includes("notify.windows")) return "Windows";
    return host;
  } catch {
    return "Onbekend apparaat";
  }
}

/** Eén apparaat uit de lijst in de instellingen (#1273). */
export interface PushApparaat {
  endpoint: string;
  user_agent: string | null;
  created_at: string;
  /** Is dit de browser waarin je nu kijkt? */
  ditApparaat: boolean;
}

/**
 * De apparaten die op jouw naam staan.
 *
 * De kaart heette "Pushmeldingen op dit apparaat" en toonde er precies nul —
 * terwijl een verlopen of ingetrokken abonnement alleen opgeruimd wordt als een
 * verzending 404/410 oplevert. Nu is te zien wat er nog leeft, en kun je een
 * oud toestel er zelf afhalen (RLS: push_select_own / push_delete_own).
 */
export async function getMijnApparaten(userId: string): Promise<PushApparaat[]> {
  const huidig = await getPushSubscription();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, user_agent, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((rij) => ({
    endpoint: rij.endpoint,
    user_agent: rij.user_agent,
    created_at: rij.created_at,
    ditApparaat: rij.endpoint === huidig?.endpoint,
  }));
}

/** Een apparaat intrekken. Het endpoint is de sleutel; de rij is toch al van
 *  jou (RLS). */
export async function vergeetApparaat(endpoint: string): Promise<void> {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) throw error;
}

/**
 * Zelfheling (#1273).
 *
 * De browser roteert het push-endpoint periodiek. De schakelaar in de
 * instellingen leest de brówser, dus die staat daarna nog steeds "aan" terwijl
 * er in de databank geen bruikbaar endpoint meer staat: meldingen aan, en er
 * komt niets. De service worker abonneert zich bij zo'n rotatie opnieuw; hier
 * schrijven we het resultaat weg zodra de app weer open is.
 *
 * Geen permissieprompt: die is al gegeven, we lezen alleen het bestaande
 * abonnement. Geeft terug of er iets hersteld is.
 */
export async function herstelAbonnement(userId: string): Promise<boolean> {
  const subscription = await getPushSubscription();
  if (!subscription) return false;
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint")
    .eq("endpoint", subscription.endpoint)
    .maybeSingle();
  if (error || data) return false;
  await bewaarAbonnement(userId, subscription);
  return true;
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
