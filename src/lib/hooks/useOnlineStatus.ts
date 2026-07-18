import { useEffect, useState } from "react";

/**
 * Volgt of de browser online is (#462): `navigator.onLine` als startwaarde, en
 * live bijgewerkt via de `online`/`offline`-vensterevents. Zo kan de UI een
 * offline-banner tonen en schrijfacties anders afhandelen.
 *
 * SSR-veilig: valt terug op `true` als er (nog) geen `navigator` is.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Status kan gewisseld zijn tussen de eerste render en het aankoppelen van
    // de listeners; één keer synchroniseren.
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
