// Roast-fundament (#183): centrale toon-regie voor de hele app. Elk roast-
// oppervlak (pias van de week/maand, profiel, …) levert een kále, feitelijke
// observatie ("feit") aan en laat kleurRoast die kleuren met de stem van de
// commentator, gedoseerd op de roast-intensiteit van de groep. Zet een speler
// zijn roast-schild aan, dan komt het feit ongekleurd terug — plagen, geen
// kwetsen, en wie niet mee wil hoeft niet. Puur en getest in roastTone.test.ts.

import type { Group, Profile, RoastIntensiteit } from "./types";

export type { RoastIntensiteit };

/** De vaste commentator-stem die de roast tekent (naam aanpasbaar). */
export const COMMENTATOR = { naam: "Coach Rudy", emoji: "🎙️" } as const;

export interface RoastCtx {
  /** Toon van de groep; bepaalt hoe hard de sneer is. */
  intensiteit: RoastIntensiteit;
  /** Heeft het doelwit zijn roast-schild aan? Dan geen sneer. */
  schild: boolean;
}

/** Coach Rudy's commentaar achter het feit aan, per niveau. Plagen, geen
 *  kwetsen: altijd over padel/ego, nooit persoonlijk. */
export const SNEER: Record<RoastIntensiteit, readonly string[]> = {
  mild: [
    "Kan de beste overkomen.",
    "Volgende keer beter, hè.",
    "Kop op, kampioen.",
    "'t Is maar padel. Toch?",
  ],
  gemeen: [
    "Pijnlijk om te zien.",
    "Doe daar eens iets aan.",
    "De cijfers liegen niet.",
    "Zwak. Gewoon zwak.",
  ],
  radioactief: [
    "Ronduit gênant.",
    "Overweeg serieus een andere sport.",
    "Schaam je — en de hele groep met je.",
    "Ik heb ballen tégen een muur beter zien terugkomen.",
  ],
} as const;

/** Stabiele, positieve index in een pool op basis van de seed. */
function kies<T>(pool: readonly T[], seed: number): T {
  return pool[((seed % pool.length) + pool.length) % pool.length];
}

/**
 * Alleen de sneer-staart van de commentator, of "" bij schild. Handig voor
 * JSX-oppervlakken die de feitelijke zin (met `<strong>` e.d.) willen behouden
 * en er enkel Coach Rudy's jab achteraan plakken.
 */
export function sneerSuffix(ctx: RoastCtx, seed: number): string {
  if (ctx.schild) return "";
  return ` — ${COMMENTATOR.emoji} ${kies(SNEER[ctx.intensiteit], seed)}`;
}

/**
 * De kále sneer-tekst (zonder streepje/emoji), of null wanneer het doelwit
 * zijn roast-schild aan heeft. Voor oppervlakken die Coach Rudy als aparte,
 * geattribueerde commentator tonen (bv. de feed-speech-bubble) i.p.v. een
 * inline staart.
 */
export function coachSneer(ctx: RoastCtx, seed: number): string | null {
  if (ctx.schild) return null;
  return kies(SNEER[ctx.intensiteit], seed);
}

/**
 * Kleurt een feitelijke observatie met de commentator-toon op het gekozen
 * niveau. Schild aan → het kále feit (neutrale variant, geen sneer). `seed`
 * (bv. hash van playerId + periode) kiest deterministisch de sneer, zodat de
 * hele groep dezelfde burn ziet.
 */
export function kleurRoast(feit: string, ctx: RoastCtx, seed: number): string {
  return feit + sneerSuffix(ctx, seed);
}

/** Leidt de roast-context af uit de groep + het doelwit-profiel. Ontbrekende
 *  velden vallen terug op de DB-defaults (gemeen / schild neer). */
export function roastCtx(
  group: Pick<Group, "roast_intensiteit"> | null | undefined,
  target: Pick<Profile, "roast_schild"> | null | undefined,
): RoastCtx {
  return {
    intensiteit: group?.roast_intensiteit ?? "gemeen",
    schild: target?.roast_schild ?? false,
  };
}

/** Kleine stabiele hash (djb2), voor een deterministische seed uit bv.
 *  playerId + periode. */
export function roastSeed(...delen: string[]): number {
  let h = 5381;
  const s = delen.join("|");
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return h;
}
