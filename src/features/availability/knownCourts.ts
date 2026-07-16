// Baannamen + types per Playtomic-tenant.
//
// Het beschikbaarheidsendpoint (playtomic.com/api/clubs/availability) geeft
// alleen resource_id's terug, geen namen of types meer (#385). Voor de
// thuisclub houden we daarom deze snapshot bij, zodat het raster dezelfde
// labels en dak-/zon-iconen toont als voorheen. Onbekende clubs (en clubs
// zonder entry) vallen terug op genummerde labels "Terrein N" zonder type —
// zie getClubAvailability in api.ts.
//
// GEGENEREERD BESTAND (#392): niet met de hand bewerken. Bijwerken kan met
// `npm run gen:courts` (scripts/gen-known-courts.mjs), dat de mapping van de
// live Playtomic-clubpagina afleidt; de wekelijkse workflow
// .github/workflows/known-courts.yml opent bij drift automatisch een PR.
// type: "roofed" = overdekt, "outdoor" = buiten (zie courtTypeLabel /
// CourtTypeIcon).

export type KnownCourt = {
  id: string;
  name: string;
  type: "roofed" | "outdoor" | "";
};

export const KNOWN_COURTS: Record<string, KnownCourt[]> = {
  // LAGO CLUB Padel Beveren — 2 overdekte banen + 1 buitenbaan.
  "91d8d419-3736-498e-90be-362de786d588": [
    { id: "81ba479c-66f6-4568-a450-db6df2f5c589", name: "Terrein 1", type: "roofed" },
    { id: "aba723a1-2fcb-49a4-b893-885999e04804", name: "Terrein 2", type: "roofed" },
    { id: "cc9dbe76-6192-4035-a24c-f3db0d556b97", name: "Terrein 3", type: "outdoor" },
  ],
};
