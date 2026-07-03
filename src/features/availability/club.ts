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
const RECENT_STORAGE_KEY = "recent-clubs";
const MAX_RECENT = 3;

function parseClub(value: unknown): Club | null {
  const c = value as Partial<Club> | null;
  if (
    c &&
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
  return null;
}

function loadClub(): Club {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CLUB;
    const club = parseClub(JSON.parse(raw));
    if (club) return club;
  } catch {
    /* opslag niet beschikbaar of onleesbaar — val terug op de thuisclub */
  }
  return DEFAULT_CLUB;
}

function loadRecentClubs(): Club[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      return list
        .map(parseClub)
        .filter((c): c is Club => c !== null)
        .slice(0, MAX_RECENT);
    }
  } catch {
    /* opslag niet beschikbaar of onleesbaar — begin met een lege lijst */
  }
  return [];
}

let current = loadClub();
let recent = loadRecentClubs();
const listeners = new Set<() => void>();

export function getClub(): Club {
  return current;
}

export function getRecentClubs(): Club[] {
  return recent;
}

export function setClub(club: Club) {
  current = club;
  // De gekozen club vooraan in de recente lijst; geen duplicaten, max 3.
  recent = [club, ...recent.filter((c) => c.id !== club.id)].slice(
    0,
    MAX_RECENT,
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(club));
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent));
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

/** De recentst gekozen clubs (nieuwste eerst) als React-state. */
export function useRecentClubs(): Club[] {
  return useSyncExternalStore(subscribe, getRecentClubs);
}
