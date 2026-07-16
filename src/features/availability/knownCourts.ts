// Baannamen + types per Playtomic-tenant.
//
// Het beschikbaarheidsendpoint (playtomic.com/api/clubs/availability) geeft
// alleen resource_id's terug, geen namen of types meer (#385). Voor de
// thuisclub houden we daarom een handmatige snapshot bij, zodat het raster
// dezelfde labels ("Terrein 1 (overdekt)") en dak-/zon-iconen toont als
// voorheen. Onbekende clubs (en clubs zonder entry) vallen terug op genummerde
// labels "Terrein N" zonder type — zie getClubAvailability in api.ts.
//
// LET OP: dit is een momentopname (juli 2026), afgeleid van de live
// clubpagina. Verbouwt de club zijn banen of vernummert Playtomic de
// resources, dan kloppen naam/type niet meer. type: "roofed" = overdekt,
// "outdoor" = buiten (zie courtTypeLabel / CourtTypeIcon).

import { DEFAULT_CLUB } from "./club";

export type KnownCourt = { id: string; name: string; type: string };

export const KNOWN_COURTS: Record<string, KnownCourt[]> = {
  // LAGO CLUB Padel Beveren — 2 overdekte banen + 1 buitenbaan.
  [DEFAULT_CLUB.id]: [
    { id: "81ba479c-66f6-4568-a450-db6df2f5c589", name: "Terrein 1", type: "roofed" },
    { id: "aba723a1-2fcb-49a4-b893-885999e04804", name: "Terrein 2", type: "roofed" },
    { id: "cc9dbe76-6192-4035-a24c-f3db0d556b97", name: "Terrein 3", type: "outdoor" },
  ],
};
