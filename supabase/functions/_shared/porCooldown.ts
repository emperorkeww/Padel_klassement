/**
 * De rem op "🔔 Herinner de groep" (#1273).
 *
 * remind-group had er geen: geen timestamp, geen teller, geen check. De knop in
 * PollCard verbergt zichzelf na gebruik via client-state, maar een
 * paginaverversing brengt hem terug — en elk ander groepslid heeft zijn eigen
 * knop. In combinatie met `renotify: true` (dezelfde tag piept opnieuw bij
 * vervanging) kon één poll een groep onbeperkt vaak laten trillen, zonder dat
 * de ontvanger die soort kon uitzetten.
 *
 * De rem staat op de poll en niet op de speler: het gaat om hoe vaak een groep
 * over dezelfde poll gepord wordt, niet om wie er op de knop drukt.
 */

/** Hoe lang een poll met rust gelaten wordt na een por. */
export const POR_COOLDOWN_MIN = 60;

export interface PorOordeel {
  mag: boolean;
  /** Hoeveel minuten er nog te gaan zijn — naar boven afgerond, zodat "nog 0
   *  minuten" niet bestaat zolang je moet wachten. */
  minutenResterend: number;
}

export function magPorren(
  laatst: string | null | undefined,
  nu: Date,
  cooldownMin = POR_COOLDOWN_MIN,
): PorOordeel {
  if (!laatst) return { mag: true, minutenResterend: 0 };
  const verstreken = nu.getTime() - new Date(laatst).getTime();
  // Onleesbare of toekomstige stempel: fail-open, net als de rest van deze
  // keten. Een rare timestamp mag een groep niet permanent op slot zetten.
  if (!Number.isFinite(verstreken) || verstreken < 0) {
    return { mag: true, minutenResterend: 0 };
  }
  const resterendMs = cooldownMin * 60_000 - verstreken;
  if (resterendMs <= 0) return { mag: true, minutenResterend: 0 };
  return { mag: false, minutenResterend: Math.ceil(resterendMs / 60_000) };
}
