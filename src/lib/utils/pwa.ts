// Platform- en PWA-detectie, gedeeld door de meldingen-kaart (#412) en de
// installatiehint (#75). Bewust vrij van supabase-imports zodat elke feature
// dit kan gebruiken.

/** Draait dit op een iPhone/iPad? Dekt ook iPadOS 13+, dat zich als Mac
 *  voordoet (Macintosh-UA mét touchscherm). */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
}

/** Is de app als PWA geopend (vanaf het beginscherm) i.p.v. in een browsertab? */
export function isStandalone(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return true;
  }
  // Safari's eigen, niet-standaard vlag; op oudere iOS-versies is dit de
  // enige betrouwbare indicator.
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Chrome/Edge-event dat de native installatieprompt kan openen. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Het beforeinstallprompt-event vuurt vlak na page-load — vóór de lazy
// dashboard-chunk geladen is. Daarom vangt main.tsx het hier eager af en
// leest de InstallPrompt-component het later uit via useSyncExternalStore.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let capturing = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

/** Start het afvangen van beforeinstallprompt/appinstalled. Eenmalig
 *  aanroepen bij app-start (main.tsx); dubbele aanroepen zijn no-ops. */
export function initInstallPromptCapture(): void {
  if (typeof window === "undefined" || capturing) return;
  capturing = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

/** Het bewaarde install-event, of null als de browser er (nog) geen gaf. */
export function getInstallPromptEvent(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

/** Abonneer op wijzigingen in het bewaarde install-event (voor
 *  useSyncExternalStore). Geeft een unsubscribe-functie terug. */
export function subscribeInstallPrompt(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Wis het bewaarde event, bv. nadat de prompt getoond is — Chrome staat
 *  maar één prompt()-aanroep per event toe. */
export function clearInstallPromptEvent(): void {
  deferredPrompt = null;
  notify();
}
