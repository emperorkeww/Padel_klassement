// Rudy's VAR (#1025): client-side evenknie van de databank-logica rond
// point_appeals. Spiegelt point_appeals_guard, de stemtelling in
// resolve_point_appeal en de partiële unieke indexen
// (point_appeals_one_open_per_match_uidx, point_appeals_tegoed_uidx) uit
// supabase/schemas/functions/36_point_appeals.sql.
//
// De guard blijft de enige echte poort; dit bestand bestaat zodat de kaart
// meteen kan tonen wat er kan en waarom je (nog) niet mag betwisten, zonder
// eerst een servererror te moeten uitlokken. Zelfde rol als stakes.ts voor de
// lef-tip en bounty.ts voor de premie.
//
// Let op waar het beroep aan hangt: niet aan een rij uit match_points (die
// tabel heeft geen enkele schrijver) maar aan de eindstand van de match,
// score_a/score_b — "de autoritaire aggregaat voor stand en ratings". Eén
// toegekend punt verschuift daar één eenheid; staat er een set-stand bij, dan
// beweegt de gekozen set mee.

import { inTeam } from "@/features/rating/results";
import { playDay } from "./stakes";
import type { SetScore } from "./api";
import type { Match, Team } from "@/types";

export type AppealReden =
  | "ons-punt"
  | "dubbele-stuit"
  | "net"
  | "buiten"
  | "verkeerd-ingetikt";

export type AppealStatus =
  | "open"
  | "toegekend"
  | "afgewezen"
  | "verlopen"
  | "tegoed-op";

export interface PointAppeal {
  id: string;
  match_id: string;
  claimant_id: string;
  /** 1-based index in set_scores; null bij een match zonder set-stand. */
  set_number: number | null;
  reden: AppealReden;
  toelichting: string | null;
  status: AppealStatus;
  /** Stand bij het indienen; wijkt de match daarvan af, dan vervalt het beroep. */
  snapshot_a: number;
  snapshot_b: number;
  /** Speeldag in clubtijd (YYYY-MM-DD) — de sleutel van het beroepstegoed. */
  play_date: string;
  votes_close_at: string;
  resolved_at: string | null;
  created_at: string;
}

export interface PointAppealVote {
  appeal_id: string;
  voter_id: string;
  akkoord: boolean;
  created_at: string;
}

/** Tot zoveel uur na de match kan er betwist worden (point_appeals_guard). */
export const VENSTER_UREN = 24;

/** Zolang loopt de stemming na het indienen (point_appeals_guard). */
export const STEM_VENSTER_UREN = 12;

/** Maximale lengte van de toelichting (check-constraint op de kolom). */
export const TOELICHTING_MAX = 140;

/** De redenen uit de check-constraint, met hun label voor de knoppenrij. */
export const REDENEN: readonly { id: AppealReden; label: string }[] = [
  { id: "ons-punt", label: "Dat punt was van ons" },
  { id: "dubbele-stuit", label: "Dubbele stuit" },
  { id: "net", label: "Het net geraakt" },
  { id: "buiten", label: "Buiten" },
  { id: "verkeerd-ingetikt", label: "Verkeerd ingetikt" },
];

/** Waarom betwisten (nog) niet kan; null = het mag. */
export type AppealBlokkade =
  | "niet-afgerond"
  | "geen-speelmoment"
  | "geen-deelnemer"
  | "geen-uitslag"
  | "venster-dicht"
  | "geen-punt-te-halen"
  | "beroep-loopt"
  | "tegoed-op"
  | "geen-stemmers";

/** In welk team van deze match staat de speler? null = hij speelde niet mee. */
export function kantVan(
  match: Match,
  teams: Record<string, Team>,
  playerId: string,
): "a" | "b" | null {
  const a = teams[match.team_a_id];
  const b = teams[match.team_b_id];
  if (a && inTeam(a, playerId)) return "a";
  if (b && inTeam(b, playerId)) return "b";
  return null;
}

/** Alle spelers van de match, zonder lege plekken (singles) en zonder dubbels. */
export function deelnemersVan(
  match: Match,
  teams: Record<string, Team>,
): string[] {
  const uit = (t: Team | undefined) =>
    t ? [t.player1_id, t.player2_id] : [];
  return [
    ...new Set(
      [...uit(teams[match.team_a_id]), ...uit(teams[match.team_b_id])].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
}

/**
 * Wie er mag stemmen: de andere deelnemers, tegenpartij inbegrepen — bij 2v2
 * zijn dat er drie, dus een gelijkspel in de stemming kan niet. Gasten vallen
 * weg: die loggen nooit in, dus hun stem zou nooit komen. Spiegelt
 * public._beroep_stemgerechtigden.
 */
export function stemgerechtigden(opts: {
  match: Match;
  teams: Record<string, Team>;
  claimantId: string;
  isGast?: (playerId: string) => boolean;
}): string[] {
  const gast = opts.isGast ?? (() => false);
  return deelnemersVan(opts.match, opts.teams).filter(
    (id) => id !== opts.claimantId && !gast(id),
  );
}

/** Sluit het VAR-venster van deze match — 24 u na het speelmoment. */
export function vensterSluit(match: Match): number | null {
  if (!match.played_at) return null;
  return new Date(match.played_at).getTime() + VENSTER_UREN * 3600_000;
}

/**
 * Is het beroepstegoed van deze speeldag al op? Eén tóekenning per speler per
 * speeldag; een afwijzing kost niets. Wordt in de databank afgedwongen door
 * point_appeals_tegoed_uidx, niet door een telling — twee beroepen op dezelfde
 * avond kunnen dus allebei openstaan en pas bij de afhandeling botsen.
 */
export function tegoedOp(eigenAppeals: PointAppeal[], playDate: string): boolean {
  return eigenAppeals.some(
    (a) => a.play_date === playDate && a.status === "toegekend",
  );
}

/**
 * Spiegel van point_appeals_guard: mag deze speler nú een punt betwisten op
 * deze match? Geeft de reden terug als het niet mag, in dezelfde volgorde als
 * de guard, zodat de melding overeenkomt met wat de server zou zeggen.
 */
export function appealBlokkade(opts: {
  match: Match;
  teams: Record<string, Team>;
  claimantId: string;
  /** Het openstaande beroep op deze match, als dat er is. */
  openAppeal?: PointAppeal | null;
  /** Alle beroepen van deze speler — voor het tegoed van de speeldag. */
  eigenAppeals?: PointAppeal[];
  isGast?: (playerId: string) => boolean;
  now?: number;
}): AppealBlokkade | null {
  const { match, teams, claimantId } = opts;
  const now = opts.now ?? Date.now();

  if (match.status !== "completed") return "niet-afgerond";
  if (!match.played_at) return "geen-speelmoment";
  const sluit = vensterSluit(match);
  if (sluit != null && now > sluit) return "venster-dicht";

  const kant = kantVan(match, teams, claimantId);
  if (kant === null) return "geen-deelnemer";

  if (match.score_a == null || match.score_b == null) return "geen-uitslag";
  // Je kunt geen punt afpakken van een team dat er geen heeft.
  const tegenpartij = kant === "a" ? match.score_b : match.score_a;
  if (tegenpartij <= 0) return "geen-punt-te-halen";

  if (opts.openAppeal && opts.openAppeal.status === "open") return "beroep-loopt";

  if (
    stemgerechtigden({ match, teams, claimantId, isGast: opts.isGast })
      .length === 0
  ) {
    return "geen-stemmers";
  }

  if (tegoedOp(opts.eigenAppeals ?? [], playDay(match.played_at))) {
    return "tegoed-op";
  }

  return null;
}

/** Uitleg bij een blokkade, voor de tekst onder de VAR-knop. */
export function blokkadeUitleg(reden: AppealBlokkade): string {
  switch (reden) {
    case "niet-afgerond":
      return "Je kunt pas betwisten als de match afgerond is.";
    case "geen-speelmoment":
      return "Zonder speelmoment valt er niets te betwisten.";
    case "venster-dicht":
      return `Het VAR-venster van ${VENSTER_UREN} uur is gesloten. De geschiedenis is geschiedenis.`;
    case "geen-deelnemer":
      return "Alleen wie meespeelde kan een punt betwisten.";
    case "geen-uitslag":
      return "Deze match heeft geen ingevulde uitslag.";
    case "geen-punt-te-halen":
      return "De tegenpartij heeft geen punt om af te staan.";
    case "beroep-loopt":
      return "Er loopt al een beroep op deze match. Eén tegelijk.";
    case "tegoed-op":
      return "Je VAR van vandaag is al gebruikt — één toekenning per speeldag.";
    case "geen-stemmers":
      return "Er is niemand die over dit beroep kan stemmen.";
  }
}

/**
 * De stand ná een toekenning: één punt schuift naar de kant van de klager, en
 * de winnaar volgt weer uit de kopscore (gelijk = gelijkspel). Spiegel van het
 * correctiedeel van resolve_point_appeal, zodat de kaart "16–15 → 15–16" kan
 * tonen vóór er gestemd is.
 *
 * Geeft null als de correctie niet kan (geen uitslag, of een score die
 * daardoor onder nul zou zakken) — dan hoort de knop er niet te staan.
 */
export function naCorrectie(opts: {
  match: Match;
  kant: "a" | "b";
  /** 1-based; alleen zinnig als er een set-stand is. */
  setNumber?: number | null;
  sets?: SetScore[] | null;
}): {
  scoreA: number;
  scoreB: number;
  sets: SetScore[] | null;
  winnerTeamId: string | null;
} | null {
  const { match, kant } = opts;
  if (match.score_a == null || match.score_b == null) return null;

  const stap = (a: number, b: number): [number, number] =>
    kant === "a" ? [a + 1, b - 1] : [a - 1, b + 1];

  const [scoreA, scoreB] = stap(match.score_a, match.score_b);
  if (scoreA < 0 || scoreB < 0) return null;

  let sets = opts.sets ?? null;
  const idx = (opts.setNumber ?? 0) - 1;
  if (sets && idx >= 0 && idx < sets.length) {
    const [sa, sb] = stap(sets[idx][0], sets[idx][1]);
    if (sa < 0 || sb < 0) return null;
    sets = sets.map((paar, i): SetScore => (i === idx ? [sa, sb] : paar));
  }

  return {
    scoreA,
    scoreB,
    sets,
    winnerTeamId:
      scoreA > scoreB
        ? match.team_a_id
        : scoreB > scoreA
          ? match.team_b_id
          : null,
  };
}

/** Draait een toekenning de winnaar van de match om? Dat moet met zoveel
 *  woorden in de feed staan, niet stilletjes gebeuren. */
export function draaitWinnaarOm(
  match: Match,
  na: { winnerTeamId: string | null },
): boolean {
  return (match.winner_team_id ?? null) !== na.winnerTeamId;
}

/** Tussenstand van de stemming, zoals resolve_point_appeal hem telt. */
export interface StemStand {
  voor: number;
  tegen: number;
  /** Aantal stemgerechtigden dat nog niet gestemd heeft. */
  open: number;
  /** De uitspraak die nu al vaststaat, of null zolang die nog kan kantelen. */
  beslist: "toegekend" | "afgewezen" | null;
  /** Hoeveel stemmen vóór er nog nodig zijn voor een toekenning. */
  nogNodig: number;
}

/**
 * Telt de stemmen precies zoals resolve_point_appeal dat doet: een strikte
 * meerderheid van álle stemgerechtigden kent toe, gelijkspel of een meerderheid
 * tegen wijst af, en wie zwijgt stemt niet mee — bij het sluiten van het venster
 * is dat dus een afwijzing.
 */
export function stemStand(
  votes: PointAppealVote[],
  kiezers: string[],
): StemStand {
  const geldig = votes.filter((v) => kiezers.includes(v.voter_id));
  const voor = geldig.filter((v) => v.akkoord).length;
  const tegen = geldig.length - voor;
  const n = kiezers.length;
  const beslist =
    voor * 2 > n ? "toegekend" : tegen * 2 >= n ? "afgewezen" : null;
  return {
    voor,
    tegen,
    open: Math.max(0, n - geldig.length),
    beslist,
    nogNodig: Math.max(0, Math.floor(n / 2) + 1 - voor),
  };
}

/**
 * Een geweigerd beroep of een geweigerde stem in gewone taal.
 *
 * De `raise`-meldingen van de guards zijn al Nederlands en leesbaar ("de
 * stemming is gesloten") en gaan ongewijzigd door. Wat hier vertaald wordt zijn
 * de botsingen op de twee partiële unieke indexen: die bewaken het tegoed en
 * het "één beroep tegelijk" bewust met een index en niet met een telling — twee
 * gelijktijdige inserts zouden een telling allebei passeren. De prijs is dat de
 * botsing als kale Postgres-tekst binnenkomt. Zelfde patroon als
 * stakeFoutMelding (#804).
 */
export function appealFoutMelding(err: unknown): string {
  const fout = err as { code?: string; message?: string } | null;
  const tekst = typeof fout?.message === "string" ? fout.message : "";
  if (fout?.code === "23505" || tekst.includes("duplicate key value")) {
    if (tekst.includes("point_appeals_one_open_per_match_uidx")) {
      return blokkadeUitleg("beroep-loopt");
    }
    if (tekst.includes("point_appeals_tegoed_uidx")) {
      return blokkadeUitleg("tegoed-op");
    }
    return "Je hebt hier al gestemd.";
  }
  return tekst || "Het beroep kwam niet door. Probeer het zo nog eens.";
}
