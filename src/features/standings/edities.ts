// Speciale edities (#497): welke speler draagt welke editie op zijn
// FUT-kaart in het klassement. Icon = Big Daddy (#1, alleen zonder échte
// dictator op de troon), In-Form = speler van de week (spelerVanDeWeek.ts).

import type { InForm } from "./spelerVanDeWeek";

export type Editie = "icon" | "inform" | null;

/** Welke editie draagt deze speler? Icon (Big Daddy) wint van In-Form. */
export function editieVoor(
  key: string,
  iconKey: string | null,
  inForm: InForm | null,
): Editie {
  if (key === iconKey) return "icon";
  if (key === inForm?.playerId) return "inform";
  return null;
}

/** Editie-regel op het kaartvlak, bv. "⚡ In-Form · +48". */
export function editieLabel(
  editie: Editie,
  inForm: InForm | null,
): string | null {
  if (editie === "icon") return "👑 Big Daddy";
  if (editie === "inform")
    return `⚡ In-Form${inForm ? ` · +${inForm.delta}` : ""}`;
  return null;
}
