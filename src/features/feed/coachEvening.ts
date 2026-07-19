// Coach Rudy's avondverslag (#204): een korte commentatormonoloog (2-3 zinnen)
// bij de speelavond-samenvatting — hype voor de held, een sneer voor de afgang
// van de avond, en een cijfer-observatie. Puur client-side, afgeleid uit de al
// berekende eveningSummary; deterministisch geseed op groep + dag, zodat de hele
// groep hetzelfde verslag ziet. Roast-quips respecteren intensiteit + schild.
// Sjabloon-gebaseerd (geen AI). Getest in coachEvening.test.ts.

import type { EveningSummary } from "@/features/feed/eveningSummary";
import type { Profile, RoastIntensiteit } from "@/types";
import { coachSneer, kiesUniek, roastCtx, roastSeed } from "@/features/coach/roastTone";

export interface AvondCtx {
  /** Roast-toon van de groep. */
  intensiteit: RoastIntensiteit;
  /** Profielen (voor het roast-schild van het doelwit). */
  profiles: Record<string, Profile>;
  /** Spelernaam-resolver ("Jij" mag de UI zelf beslissen; hier gewoon de naam). */
  naam: (playerId: string) => string;
  /** Gedeelde set om herhaling met de rest van de feed te vermijden (#201). */
  gebruikt?: Set<string>;
}

/** Flavors voor de held van de avond (hype, niet door het schild beperkt). */
const HELD_FLAVOR = [
  "was onaantastbaar",
  "speelde iedereen van de baan",
  "was helemaal op dreef",
  "liet zien wie de baas is",
  "domineerde de avond",
  "kende geen genade",
  "heeft de hele boel vakkundig gesloopt vandaag",
  "had vandaag vleugels op de baan",
  "was met geen mogelijkheid te passeren aan het net",
  "heeft een gratis lesje padel uitgedeeld",
  "speelde alsof de tegenstanders er puur voor spek en bonen bij stonden",
  "liet de tegenpartij alle hoeken van de kooi zien",
  "had vandaag de tactische genialiteit in zijn vingers die ik op het WK miste",
  "speelde zo sterk dat zelfs ik er geen kritische noot over kan schrijven",
  "heeft een ware demonstratie van tactisch padel gegeven",
  "was niet te stoppen en regeerde als een koning in de kooi",
  "liet de bal dansen op de baan en gaf iedereen het nakijken",
  "speelde met de precisie van een Zwitsers uurwerk",
  "had de regie stevig in handen en dicteerde elke rally",
  "liet de concurrentie volstrekt gedesillusioneerd achter",
  "speelde zo soepel dat m'n sportpet er bijna van afwaaide",
] as const;

/** Cijfer-flavors als er geen upset was om te melden. */
const CIJFER_FLAVOR = [
  "Netjes gevuld programma.",
  "Daar zat serieus wat padel bij.",
  "De baan heeft overuren gedraaid.",
  "De baromzet zal na al die sets ook wel flink gestegen zijn.",
  "Mijn kladblok staat helemaal volgeschreven met uitslagen.",
  "De glazen wanden trillen nog na van al dat smashgeweld.",
  "Sommige ballen liggen waarschijnlijk nu nog ergens diep in de struiken.",
  "Mijn pen heeft overuren gedraaid en is nu officieel leeggeschreven.",
  "Een avond vol tactische experimenten langs de lijn.",
  "M'n notitieboekje heeft rode bladzijden van alle genoteerde uitslagen.",
  "De lichten van de padelclub stonden op het punt te knappen.",
  "We hebben weer een hele stapel statistieken om te verwerken.",
  "Een programma zo vol dat m'n sportpet er bijna van afvloog.",
  "Zoveel padel dat we er een extra persconferentie voor moeten inplannen.",
  "De kooi heeft alle hoeken gezien vanavond.",
  "Genoeg data verzameld om een heel boekwerk mee te vullen.",
] as const;

/**
 * Coach Rudy's avondverslag als lijst zinnen (0-3). Leeg als er niets te melden
 * valt (geen matches). `seedKey` = bv. `groupId|dag`.
 */
export function coachAvond(
  summary: EveningSummary,
  seedKey: string,
  ctx: AvondCtx,
): string[] {
  if (summary.rows.length === 0) return [];
  const gebruikt = ctx.gebruikt ?? new Set<string>();
  const seed = roastSeed(seedKey);
  const lijnen: string[] = [];

  // 1) Held van de avond (hype).
  const held = summary.rows[0];
  if (held.won > 0) {
    const flavor = kiesUniek(HELD_FLAVOR, seed, gebruikt);
    lijnen.push(`${ctx.naam(held.playerId)} ${flavor} — ${winsten(held.won)}.`);
  }

  // 2) Afgang van de avond (sneer, respecteert schild). De onderste in de stand
  //    die vaker verloor dan won; niet dezelfde persoon als de held.
  const afgang = [...summary.rows]
    .reverse()
    .find((r) => r.lost > r.won && r.playerId !== held.playerId);
  if (afgang) {
    const sneer = coachSneer(
      roastCtx({ roast_intensiteit: ctx.intensiteit }, ctx.profiles[afgang.playerId]),
      roastSeed(seedKey, afgang.playerId),
      gebruikt,
    );
    const feit = `${ctx.naam(afgang.playerId)} ging ${keer(afgang.lost)} onderuit`;
    lijnen.push(sneer ? `${feit} — ${sneer}` : `${feit}.`);
  }

  // 3) Cijfer-observatie: liefst de upset, anders het volume.
  if (summary.biggestUpset) {
    lijnen.push(
      `En een echte upset: gewonnen met maar ${Math.round(summary.biggestUpset.chance * 100)}% kans vooraf.`,
    );
  } else if (summary.matches.length >= 2) {
    lijnen.push(
      `${summary.matches.length} matches op de teller. ${kiesUniek(CIJFER_FLAVOR, seed, gebruikt)}`,
    );
  }

  return lijnen;
}

const winsten = (n: number) => (n === 1 ? "1 keer winst" : `${n} keer winst`);
const keer = (n: number) => (n === 1 ? "1 keer" : `${n} keer`);
