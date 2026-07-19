// Service-worker update-flow (#463).
//
// De SW (public/sw.js) roept géén skipWaiting meer aan: een nieuwe versie
// blijft "waiting" tot de gebruiker bewust herlaadt. Dit voorkomt dat een
// open tab midden in een sessie op een nieuwe SW overschakelt die de oude
// asset-cache wegschoont — waarna een lazy route-chunk met een oude hash
// nergens meer te vinden is (kapotte route tot een handmatige refresh).
//
// Hier detecteren we een wachtende worker en bieden we applyUpdate() aan;
// een <SwUpdatePrompt/> leest dit reactief uit via useSyncExternalStore
// (zelfde patroon als de install-prompt in pwa.ts).

let waiting: ServiceWorker | null = null;
let updateAvailable = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

function setWaiting(worker: ServiceWorker | null) {
  waiting = worker;
  const next = worker !== null;
  if (next === updateAvailable) return;
  updateAvailable = next;
  notify();
}

/** Abonneer op wijzigingen in "staat er een update klaar?" (useSyncExternalStore).
 *  Geeft een unsubscribe-functie terug. */
export function subscribeSwUpdate(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Staat er een nieuwe versie klaar om geactiveerd te worden? */
export function getSwUpdateSnapshot(): boolean {
  return updateAvailable;
}

/** Activeer de wachtende versie: de SW roept dan skipWaiting aan, waarna
 *  het controllerchange-event de pagina één keer gecontroleerd herlaadt.
 *  No-op als er geen worker wacht. */
export function applyUpdate(): void {
  waiting?.postMessage({ type: "SKIP_WAITING" });
}

/** Registreer de service worker en zet de update-detectie op. Alleen in
 *  productie aanroepen (in dev botst caching met Vite's hot-reload). */
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  const container = navigator.serviceWorker;

  // Eén gecontroleerde reload zodra de nieuwe SW de controle overneemt.
  let reloaded = false;
  container.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    container
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        // Al een wachtende worker bij registratie (bv. tab lang open gestaan).
        if (registration.waiting && container.controller) {
          setWaiting(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" mét bestaande controller = update; zónder controller
            // is dit de allereerste install (dan geen melding tonen).
            if (installing.state === "installed" && container.controller) {
              setWaiting(registration.waiting ?? installing);
            }
          });
        });
      })
      .catch(() => {
        /* offline-ondersteuning is optioneel; registratiefouten negeren */
      });
  });
}
