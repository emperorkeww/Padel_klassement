import type { CourtType } from "@/types";

// Presentatie van het baantype (#471): label + icoontje, gedeeld door de
// match-invoer (NewMatchSheet) en de baanvoorkeuren-statistiek op het profiel.
// De volgorde bepaalt hoe de keuzeknoppen en de statistiek gesorteerd staan.

export interface CourtTypeInfo {
  type: CourtType;
  label: string;
  icon: string;
}

export const COURT_TYPES: CourtTypeInfo[] = [
  { type: "binnen", label: "Binnen", icon: "🏠" },
  { type: "buiten", label: "Buiten", icon: "🌤️" },
  { type: "panorama", label: "Panorama", icon: "🪟" },
  { type: "muur", label: "Muur", icon: "🧱" },
];

const BY_TYPE: Record<CourtType, CourtTypeInfo> = Object.fromEntries(
  COURT_TYPES.map((c) => [c.type, c]),
) as Record<CourtType, CourtTypeInfo>;

/** Label voor een baantype ("Panorama"); lege string voor null/onbekend. */
export function courtTypeLabel(type: CourtType | null | undefined): string {
  return type ? (BY_TYPE[type]?.label ?? "") : "";
}

/** Icoontje voor een baantype; lege string voor null/onbekend. */
export function courtTypeIcon(type: CourtType | null | undefined): string {
  return type ? (BY_TYPE[type]?.icon ?? "") : "";
}
