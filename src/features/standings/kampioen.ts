// Seizoenskampioen (#625): de winnaar van het vórige kwartaal draagt de
// Kampioen-editie op zijn FUT-kaart, het hele lopende kwartaal lang. De
// stand komt uit dezelfde seizoens-RPC als de globale seizoenstand op het
// klassement (punten-volgorde), gecacht per kwartaal.

import { seasonFor, type Season } from "@/features/rating/seasons";
import type { PlayerStanding } from "@/types";
import { getSeasonPlayerStandings } from "./api";

export interface Kampioen {
  playerId: string;
  /** Het gewonnen kwartaal, bv. "Q2 2026" — voor de editie-regel. */
  seasonLabel: string;
}

/** Het kwartaal vóór dat van `now` — per definitie afgesloten, dus mét
 *  kampioen. Eén milliseconde vóór de kwartaalstart valt in het vorige
 *  kwartaal, ook over een jaarwissel heen. */
export function vorigSeizoen(now: Date = new Date()): Season {
  const huidig = seasonFor(now);
  return seasonFor(new Date(huidig.start.getTime() - 1));
}

/** Pure selectie: de #1 van de (door de RPC al gesorteerde) seizoenstand;
 *  null zonder spelers. Zelfde keuze als de kampioensposter (rows[0]). */
export function seizoenskampioen(
  rows: PlayerStanding[],
  seasonLabel: string,
): Kampioen | null {
  const top = rows[0];
  return top ? { playerId: top.player_id, seasonLabel } : null;
}

/** Kampioen van het vorige kwartaal; null zonder matches in dat kwartaal.
 *  Leunt op de cache van getSeasonPlayerStandings, dus alle plekken die de
 *  editie tonen delen dezelfde fetch. */
export async function getSeizoenskampioen(
  now: Date = new Date(),
): Promise<Kampioen | null> {
  const seizoen = vorigSeizoen(now);
  const rows = await getSeasonPlayerStandings(
    seizoen.start.toISOString(),
    seizoen.end.toISOString(),
  );
  return seizoenskampioen(rows, seizoen.label);
}