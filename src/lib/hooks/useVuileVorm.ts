import { useEffect, useSyncExternalStore } from "react";

/**
 * Houdt bij welke formulieren onopgeslagen wijzigingen hebben (#921).
 *
 * Naam, e-mail en wachtwoord waren gewone formulieren: van tab wisselen of het
 * tabblad sluiten gooide ze stil weg, terwijl de avatar wél een "Nog niet
 * opgeslagen"-badge had.
 *
 * Wat dit níet doet: wegnavigeren binnen de app blokkeren. Dat vraagt React
 * Router's `useBlocker`, en die werkt alleen op een data-router — de app draait
 * op `<BrowserRouter>`. De aanroeper die wél door eigen code loopt (de
 * tabwissel in Instellingen) kan `heeftVuileVorm()` uitlezen en zelf om
 * bevestiging vragen.
 */

const vuil = new Set<string>();
const luisteraars = new Set<() => void>();

function meld() {
  for (const fn of luisteraars) fn();
}

function abonneer(fn: () => void) {
  luisteraars.add(fn);
  return () => {
    luisteraars.delete(fn);
  };
}

/** Staat er ergens onopgeslagen werk? Voor een bevestiging vóór een tabwissel. */
export function heeftVuileVorm(): boolean {
  return vuil.size > 0;
}

/**
 * Meldt dit formulier aan of af als "onopgeslagen", en waarschuwt bij het
 * sluiten van het tabblad zolang er iets openstaat.
 *
 * @param id    Stabiele sleutel per formulier ("naam", "email", …).
 * @param isVuil Of er nu onopgeslagen wijzigingen zijn.
 */
export function useVuileVorm(id: string, isVuil: boolean) {
  useEffect(() => {
    if (isVuil) vuil.add(id);
    else vuil.delete(id);
    meld();
    return () => {
      vuil.delete(id);
      meld();
    };
  }, [id, isVuil]);

  useEffect(() => {
    if (!isVuil) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      // De moderne manier; browsers tonen hun eigen, niet-aanpasbare tekst.
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [isVuil]);
}

/** Reactief "staat er ergens iets open?", voor UI die daarop moet reageren. */
export function useHeeftVuileVorm(): boolean {
  return useSyncExternalStore(abonneer, heeftVuileVorm, () => false);
}
