/** NL-label bij een Playtomic-baantype, voor tooltips en rijkoppen. */
export function courtTypeLabel(type: string): string {
  if (type === "roofed") return "overdekt";
  if (type === "outdoor") return "buiten";
  return "";
}

/** Korte NL-datum, bv. "1 jul". Leeg bij ontbrekende datum. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}
