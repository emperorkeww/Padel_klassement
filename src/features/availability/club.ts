// De gekozen Playtomic-club (locatie van de banen). De keuze is een
// persoonlijke voorkeur en leeft daarom in localStorage, niet in de URL:
// hij geldt overal in de app (ook op het dashboard) en blijft staan tussen
// bezoeken.

import { useSyncExternalStore } from "react";

export type Club = {
  /** Playtomic tenant-id; werkt ook als "slug" in de clubpagina-URL. */
  id: string;
  name: string;
  city: string;
  /** IANA-tijdzone van de club, bv. "Europe/Brussels". */
  timezone: string;
};

/** De thuisclub van de groep: standaard én fallback bij onleesbare opslag. */
export const DEFAULT_CLUB: Club = {
  id: "91d8d419-3736-498e-90be-362de786d588",
  name: "LAGO CLUB Padel Beveren",
  city: "Beveren",
  timezone: "Europe/Brussels",
};

const STORAGE_KEY = "selected-club";

function loadClub(): Club {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CLUB;
    const c = JSON.parse(raw) as Partial<Club>;
    if (
      typeof c.id === "string" &&
      typeof c.name === "string" &&
      typeof c.timezone === "string"
    ) {
      return {
        id: c.id,
        name: c.name,
        city: typeof c.city === "string" ? c.city : "",
        timezone: c.timezone,
      };
    }
  } catch {
    /* opslag niet beschikbaar of onleesbaar — val terug op de thuisclub */
  }
  return DEFAULT_CLUB;
}

let current = loadClub();
const listeners = new Set<() => void>();

export function getClub(): Club {
  return current;
}

export function setClub(club: Club) {
  current = club;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(club));
  } catch {
    /* privémodus e.d.: de keuze geldt dan alleen voor deze sessie */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** De gekozen club als React-state: componenten her-renderen bij setClub(). */
export function useClub(): Club {
  return useSyncExternalStore(subscribe, getClub);
}
