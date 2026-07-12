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
    "Kan de beste overkomen. Maar jij bent niet de beste.",
    "Volgende keer beter, hè. Of slechter, als dat fysiek nog mogelijk is.",
    "Kop op, kampioen. Er is altijd nog jeu de boules.",
    "'t Is maar padel. Al leek dit vandaag meer op ballet.",
    "Op papier was dit waarschijnlijk een tactisch meesterwerk.",
    "Goed geprobeerd! De inzet was er, de techniek liet helaas verstek gaan.",
    "Je hield de spanning er in ieder geval goed in voor de toeschouwers.",
    "Sportiviteit is ook een prijs waard. Gelukkig voor jou.",
    "Iedereen heeft een offdag.",
    "Morgen is er weer een kans.",
    "Daar leer je van, zeggen ze.",
    "Niet getreurd, blijven oefenen.",
    "Het zat gewoon even tegen.",
    "Volgende keer pak je ze wel.",
    "Gebeurt de beste weleens.",
    "Schud het van je af.",
  ],
  gemeen: [
    "Pijnlijk om te zien. Zelfs het publiek keek collectief weg.",
    "Was dit padel of een wanhopige poging tot moderne dans?",
    "Ik wist niet dat je de glazen wand zo intensief kon testen.",
    "Je tegenstanders danken je hartelijk voor de gratis punten.",
    "Mijn oma reageert opmerkelijk sneller op een diepe lob.",
    "De cijfers liegen niet, en ze vertellen geen sprookje.",
    "Zwak. Gewoon heel zwak. Heb je je racket wel eens andersom vastgehouden?",
    "Had je je zonnebril nog op? Of speelde je gewoon met je ogen dicht?",
    "Dat was geen hoogstandje.",
    "Ik zag het al van ver aankomen.",
    "Trainen is geen straf, hè.",
    "Je maat verdient echt beter.",
    "Even diep ademhalen en nadenken.",
    "Dat blijft nog even nagalmen.",
    "Niet je beste werk. Understatement.",
    "Daar praten we volgende week nog over.",
  ],
  radioactief: [
    "Ronduit gênant. Zelfs de bal leek te weigeren om met je mee te werken.",
    "Overweeg serieus een andere hobby. Schaken of postzegels verzamelen?",
    "Als falen een olympische discipline was, stond je nu bovenaan het podium.",
    "Ik heb tennisballen tégen een blinde muur beter zien terugkomen.",
    "Dit was geen wedstrijd, dit was een regelrechte misdaad tegen de padelsport.",
    "Zullen we je lidmaatschap stilletjes omruilen voor een abonnement op Netflix?",
    "Je bewoog met de gratie van een natte krant in een zware herfststorm.",
    "Zelfs de scheidsrechter had medelijden — en we hebben niet eens een scheidsrechter.",
    "Dit zet ik in de groepschat. Voor de eeuwigheid.",
    "Mijn oma slaat harder. En die padelt niet eens.",
    "Was dat opzet? Zeg alsjeblieft ja.",
    "Een standbeeld had meer ballen geraakt.",
    "Ik heb geen woorden. Nou ja, deze dan.",
    "Je tegenstander verveelde zich kapot.",
    "Historisch slecht. Dat is óók een prestatie.",
    "Ik zou m'n racket inleveren. Definitief.",
  ],
} as const;

/** Deterministische, positieve start-index in een pool op basis van de seed. */
function seedIndex(len: number, seed: number): number {
  return ((seed % len) + len) % len;
}

/**
 * Kiest deterministisch uit de pool op basis van de seed, maar slaat lijnen in
 * `gebruikt` over (probeert opeenvolgende indices) zodat één weergave geen
 * dubbele quip toont; de gekozen lijn wordt aan `gebruikt` toegevoegd. Valt
 * terug op de kále seed-keuze als alles al gebruikt is. Zonder `gebruikt`
 * gedraagt hij zich exact als een gewone seed-keuze (voor single-item-
 * oppervlakken zoals profiel/PiasCard, waar dedup niet nodig is).
 */
export function kiesUniek<T>(
  pool: readonly T[],
  seed: number,
  gebruikt?: Set<T>,
): T {
  const len = pool.length;
  const start = seedIndex(len, seed);
  if (gebruikt) {
    for (let k = 0; k < len; k++) {
      const kandidaat = pool[(start + k) % len];
      if (!gebruikt.has(kandidaat)) {
        gebruikt.add(kandidaat);
        return kandidaat;
      }
    }
  }
  return pool[start];
}

/**
 * Alleen de sneer-staart van de commentator, of "" bij schild. Handig voor
 * JSX-oppervlakken die de feitelijke zin (met `<strong>` e.d.) willen behouden
 * en er enkel Coach Rudy's jab achteraan plakken.
 */
export function sneerSuffix(ctx: RoastCtx, seed: number): string {
  if (ctx.schild) return "";
  return ` — ${COMMENTATOR.emoji} ${kiesUniek(SNEER[ctx.intensiteit], seed)}`;
}

/**
 * De kále sneer-tekst (zonder streepje/emoji), of null wanneer het doelwit
 * zijn roast-schild aan heeft. Voor oppervlakken die Coach Rudy als aparte,
 * geattribueerde commentator tonen (bv. de feed-speech-bubble) i.p.v. een
 * inline staart. Geef optioneel een `gebruikt`-set mee om binnen één weergave
 * (bv. de feed-lijst) herhaling van dezelfde sneer te vermijden.
 */
export function coachSneer(
  ctx: RoastCtx,
  seed: number,
  gebruikt?: Set<string>,
): string | null {
  if (ctx.schild) return null;
  return kiesUniek(SNEER[ctx.intensiteit], seed, gebruikt);
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
