// Wat er náást de uitslag op een historiekaart mag (#1144).
//
// De kaart plakte tot nu toe elke feature zijn eigen regel onder de score: de
// relatieve dag, 1v1, upset, de set-stand, de lef-inzet, de joker en de
// traktatie. Zeven regels in het slechtste geval, en elke nieuwe feature maakte
// er één bij — precies de groei die #1144 wil stoppen.
//
// Eén extra regel dus, en een teller voor wat er verder nog te zien is. Niet
// omdat de rest onbelangrijk is, maar omdat een lijst een lijst is: je scant
// hem op "wie speelde er tegen wie en hoe liep het af", en tikt door voor de
// rest. Het matchdetail toont alles.

import type { Match } from "@/types";
import type { Upset } from "@/features/matches/upset";
import { formatSetScores, readSetScores } from "@/features/matches/api";
import { traktatieRegel } from "@/features/matches/drankkaart";

export interface HistorieMeta {
  /** De ene regel die getoond wordt. */
  tekst: string;
  /** Waar hij vandaan komt — handig voor een klasse en voor de tests. */
  sleutel: "upset" | "joker" | "lef" | "traktatie" | "sets";
  /** Hoeveel er nog méér te zien is op het matchdetail; 0 = niets. */
  rest: number;
}

/**
 * De volgorde waarin de kandidaten strijden om die ene regel.
 *
 * Bovenaan wat er tussen deze twee teams gebéurde en niet uit de score valt af
 * te lezen (een upset), dan de keuzes die de uitslag anders lieten wegen (joker
 * vóór lef: de joker is er één per maand, de lef-tip één per dag), dan de
 * sociale afspraak, en als laatste de set-stand — die zegt hetzelfde als de
 * eindscore, alleen gedetailleerder.
 */
export function historieMeta(opts: {
  match: Match;
  /** Upset-indicatie (#85); alleen bij een afgeronde underdog-winst. */
  upset?: Upset | null;
  /** Kant-en-klare jokerregel via jokerKaartRegel (#1003). */
  joker?: string | null;
  /** Kant-en-klare lef-regel via lefKaartRegel (#981). */
  lef?: string | null;
}): HistorieMeta | null {
  const { match } = opts;
  const done = match.status === "completed";
  const setLine = formatSetScores(readSetScores(match));
  const traktatie = traktatieRegel(match);

  const kandidaten: { sleutel: HistorieMeta["sleutel"]; tekst: string }[] = [];
  if (done && opts.upset) {
    kandidaten.push({
      sleutel: "upset",
      tekst: `🎯 upset · ${Math.round(opts.upset.chance * 100)}% kans`,
    });
  }
  if (opts.joker) kandidaten.push({ sleutel: "joker", tekst: opts.joker });
  if (opts.lef) kandidaten.push({ sleutel: "lef", tekst: opts.lef });
  if (traktatie) kandidaten.push({ sleutel: "traktatie", tekst: traktatie });
  if (setLine) kandidaten.push({ sleutel: "sets", tekst: setLine });

  if (kandidaten.length === 0) return null;
  return { ...kandidaten[0], rest: kandidaten.length - 1 };
}
