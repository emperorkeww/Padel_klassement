// Coach Rudy's avondverslag (#204): een korte commentatormonoloog (2-3 zinnen)
// bij de speelavond-samenvatting — hype voor de held, een sneer voor de afgang
// van de avond, en een cijfer-observatie. Puur client-side, afgeleid uit de al
// berekende eveningSummary; deterministisch geseed op groep + dag, zodat de hele
// groep hetzelfde verslag ziet. Roast-quips respecteren intensiteit + schild.
// Sjabloon-gebaseerd (geen AI). Getest in coachEvening.test.ts.

import type { EveningSummary } from "@/features/feed/eveningSummary";
import type { Match, Profile, RoastIntensiteit, Team } from "@/types";
import { coachSneer, kiesUniek, roastCtx, roastSeed } from "@/features/coach/roastTone";
import { margeVan } from "@/features/coach/coachStats";
import { inTeam, playersOf } from "@/features/rating/results";

export interface AvondCtx {
  /** Roast-toon van de groep. */
  intensiteit: RoastIntensiteit;
  /** Profielen (voor het roast-schild van het doelwit). */
  profiles: Record<string, Profile>;
  /** Spelernaam-resolver ("Jij" mag de UI zelf beslissen; hier gewoon de naam). */
  naam: (playerId: string) => string;
  /** Teams van de avond-matches (#580): nodig om tegenstanders/scores te noemen.
   *  Ontbreekt het, dan valt het verslag terug op de generieke flavors. */
  teams?: Record<string, Team>;
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
  "veegde de vloer aan met de tegenstander",
  "was simpelweg een klasse apart vanavond",
  "liet zien waarom die bovenaan de ranglijst thuishoort",
  "speelde met een ongekende intensiteit en focus",
  "gaf een masterclass in omschakelingspadel",
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
  "De statistieken stromen binnen en ze zien er heerlijk uit.",
  "Een avond die nog lang zal nagalmen in de kantine.",
  "De banen zijn warm gespeeld, m'n notitieboekje ook.",
  "Genoeg spektakel om een hele persconferentie mee te vullen.",
  "Heerlijke potjes gezien. Mijn coach-hart sprong op.",
] as const;

// ── Concrete varianten (#580): benutten tegenstander + score als `teams` er is ─
// %tegenstander% = naam/namen van de tegenpartij, %score% = uitslag vanuit de
// held (bv. "6-1"). Gebruikt i.p.v. de generieke HELD_FLAVOR bij een marge ≥ 2.
const HELD_CONCREET = [
  "walste over %tegenstander% (%score%)",
  "vernederde %tegenstander% met %score%",
  "gaf %tegenstander% een openbaar lesje padel (%score%)",
  "stuurde %tegenstander% met %score% naar huis",
  "maakte gehakt van %tegenstander% (%score%)",
  "liet %tegenstander% kansloos: %score%",
  "droogde %tegenstander% af met %score%",
  "speelde %tegenstander% van de baan (%score%)",
  "gaf %tegenstander% geen schijn van kans (%score%)",
  "walste %tegenstander% plat met een klinkende %score%",
] as const;

// %naam% = winnaar(s) van de upset, %pct% = winkans vooraf in procenten.
const UPSET_CONCREET = [
  "En een echte upset: %naam% won met maar %pct%% kans vooraf.",
  "De verrassing van de avond: %naam% pakte de winst met slechts %pct%% kans vooraf.",
  "Tegen alle statistieken in won %naam% — %pct%% kans, en tóch raak.",
  "%naam% lapte mijn voorspelling aan de laars en won met %pct%% kans vooraf.",
  "Upset alert: %naam% won waar ik maar %pct%% kans op gaf.",
  "Niemand zag het aankomen, ik ook niet: %naam% won met %pct%% kans vooraf.",
] as const;

/** Vervangt %sleutel%-placeholders in een quip (zoals coachMoments' vul). */
function vul(zin: string, subs: Record<string, string | number>): string {
  let out = zin;
  for (const [k, v] of Object.entries(subs)) out = out.replaceAll(`%${k}%`, String(v));
  return out;
}

/**
 * Grootste-marge-winst van `playerId` deze avond, alleen bij een overtuigende
 * marge (≥ 2 games). Null als die er niet is — dan valt de held terug op de
 * generieke flavor. `matches` zijn de afgeronde avond-matches.
 */
function signatuurZege(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): { tegenstanders: string[]; scoreVoor: number; scoreTegen: number } | null {
  let beste:
    | { tegenstanders: string[]; scoreVoor: number; scoreTegen: number; marge: number }
    | null = null;
  for (const m of matches) {
    if (m.status !== "completed" || !m.winner_team_id) continue;
    const inA = inTeam(teams[m.team_a_id], playerId);
    const inB = inTeam(teams[m.team_b_id], playerId);
    if (!inA && !inB) continue;
    const mijnTeam = inA ? m.team_a_id : m.team_b_id;
    if (m.winner_team_id !== mijnTeam) continue; // enkel winst
    const marge = margeVan(m);
    if (marge == null || marge < 2) continue;
    if (beste && marge <= beste.marge) continue;
    beste = {
      tegenstanders: playersOf(teams[inA ? m.team_b_id : m.team_a_id]),
      scoreVoor: (inA ? m.score_a : m.score_b) ?? 0,
      scoreTegen: (inA ? m.score_b : m.score_a) ?? 0,
      marge,
    };
  }
  return beste
    ? {
        tegenstanders: beste.tegenstanders,
        scoreVoor: beste.scoreVoor,
        scoreTegen: beste.scoreTegen,
      }
    : null;
}

/**
 * Was de zwaarste nederlaag van `playerId` deze avond een bagel (zelf 0 games)?
 * Levert de uitslag voor de "waaronder een kale 0-6"-toevoeging, anders null.
 */
function afgangBagel(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): { scoreVoor: number; scoreTegen: number } | null {
  let ergste: { scoreVoor: number; scoreTegen: number; marge: number } | null = null;
  for (const m of matches) {
    if (m.status !== "completed" || !m.winner_team_id) continue;
    const inA = inTeam(teams[m.team_a_id], playerId);
    const inB = inTeam(teams[m.team_b_id], playerId);
    if (!inA && !inB) continue;
    const mijnTeam = inA ? m.team_a_id : m.team_b_id;
    if (m.winner_team_id === mijnTeam) continue; // enkel verlies
    const scoreVoor = (inA ? m.score_a : m.score_b) ?? 0;
    const scoreTegen = (inA ? m.score_b : m.score_a) ?? 0;
    const marge = margeVan(m);
    if (marge == null || scoreVoor !== 0) continue; // enkel bagels
    if (!ergste || marge > ergste.marge) ergste = { scoreVoor, scoreTegen, marge };
  }
  return ergste ? { scoreVoor: ergste.scoreVoor, scoreTegen: ergste.scoreTegen } : null;
}

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

  // 1) Held van de avond (hype). Met `teams` en een overtuigende zege (marge ≥ 2)
  //    benoemen we tegenstander + score; anders de generieke flavor.
  const held = summary.rows[0];
  if (held.won > 0) {
    const zege = ctx.teams
      ? signatuurZege(summary.matches, ctx.teams, held.playerId)
      : null;
    const flavor =
      zege && zege.tegenstanders.length > 0
        ? vul(kiesUniek(HELD_CONCREET, seed, gebruikt), {
            tegenstander: zege.tegenstanders.map(ctx.naam).join(" & "),
            score: `${zege.scoreVoor}-${zege.scoreTegen}`,
          })
        : kiesUniek(HELD_FLAVOR, seed, gebruikt);
    lijnen.push(`${ctx.naam(held.playerId)} ${flavor} — ${winsten(held.won)}.`);
  }

  // 2) Afgang van de avond (sneer, respecteert schild). De onderste in de stand
  //    die vaker verloor dan won; niet dezelfde persoon als de held. Was de
  //    zwaarste nederlaag een bagel, dan noemen we die er expliciet bij.
  const afgang = [...summary.rows]
    .reverse()
    .find((r) => r.lost > r.won && r.playerId !== held.playerId);
  if (afgang) {
    const sneer = coachSneer(
      roastCtx({ roast_intensiteit: ctx.intensiteit }, ctx.profiles[afgang.playerId]),
      roastSeed(seedKey, afgang.playerId),
      gebruikt,
    );
    const bagel = ctx.teams
      ? afgangBagel(summary.matches, ctx.teams, afgang.playerId)
      : null;
    const kern = `${ctx.naam(afgang.playerId)} ging ${keer(afgang.lost)} onderuit`;
    const feit = bagel
      ? `${kern}, waaronder een kale ${bagel.scoreVoor}-${bagel.scoreTegen}`
      : kern;
    lijnen.push(sneer ? `${feit} — ${sneer}` : `${feit}.`);
  }

  // 3) Cijfer-observatie: liefst de upset (met winnaarsnaam als `teams` er is),
  //    anders het volume.
  if (summary.biggestUpset) {
    const pct = Math.round(summary.biggestUpset.chance * 100);
    const winnaars = ctx.teams
      ? playersOf(ctx.teams[summary.biggestUpset.winnerTeamId])
      : [];
    lijnen.push(
      winnaars.length > 0
        ? vul(kiesUniek(UPSET_CONCREET, seed, gebruikt), {
            naam: winnaars.map(ctx.naam).join(" & "),
            pct,
          })
        : `En een echte upset: gewonnen met maar ${pct}% kans vooraf.`,
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
