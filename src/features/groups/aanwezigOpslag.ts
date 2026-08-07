// Onthouden wie je met de hand aan- of uitzette op de speeldag (#1089).
//
// De deelnemerslijst begint bij de poll van vandaag (of bij alle leden als er
// geen poll is) en is daarna bij te sturen. Die correcties waren tot nu toe
// weg na een refresh: de selectie werd bij elke mount opnieuw uit de poll
// afgeleid, en wie net vier namen had uitgezet mocht opnieuw beginnen.
//
// Wat we bewaren zijn niet de aanwezigen maar de *afwijkingen* — per speler-id
// een expliciete ja of nee. Zo blijft de poll de bron voor iedereen die je nog
// niet hebt aangeraakt: iemand die na jouw correctie alsnog "ja" stemt,
// verschijnt gewoon in de lijst. Zou je de hele set bewaren, dan bevroor je de
// avond op het moment dat je één naam aantikte.
//
// De sleutel draagt de dag, zodat morgen vanzelf schoon begint; oude sleutels
// van dezelfde groep worden opgeruimd zodra er een nieuwe bijkomt. Sinds #1146
// mag er een moment achter: een dag kan twee speeldagen dragen (ochtend +
// avond), en een correctie op de ene hoort de andere niet te raken. Het
// opruimen kijkt daarom naar het dag-deel van de sleutel, zodat de twee
// speeldagen van vandaag elkaar niet wegvegen.

import { readFlag, writeFlag } from "@/lib/utils/localFlag";

/** Speler-id → expliciet aan (true) of uit (false). */
export type AanwezigKeuzes = Record<string, boolean>;

const PREFIX = "groep:";
const MIDDEN = ":aanwezig:";

export function aanwezigSleutel(
  groupId: string,
  dag: string,
  moment?: string | null,
): string {
  const staart = moment ? `${dag}@${moment}` : dag;
  return `${PREFIX}${groupId}${MIDDEN}${staart}`;
}

export function leesKeuzes(
  groupId: string,
  dag: string,
  moment?: string | null,
): AanwezigKeuzes {
  const rauw = readFlag(aanwezigSleutel(groupId, dag, moment));
  if (!rauw) return {};
  try {
    const parsed: unknown = JSON.parse(rauw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const uit: AanwezigKeuzes = {};
    for (const [id, waarde] of Object.entries(parsed)) {
      if (typeof waarde === "boolean") uit[id] = waarde;
    }
    return uit;
  } catch {
    // Onleesbare opslag is geen fout om de pagina voor te laten struikelen;
    // dan begint de dag gewoon bij de poll.
    return {};
  }
}

export function bewaarKeuzes(
  groupId: string,
  dag: string,
  keuzes: AanwezigKeuzes,
  moment?: string | null,
): void {
  ruimOudeKeuzes(groupId, dag);
  const sleutel = aanwezigSleutel(groupId, dag, moment);
  if (Object.keys(keuzes).length === 0) {
    writeFlag(sleutel, null);
    return;
  }
  writeFlag(sleutel, JSON.stringify(keuzes));
}

/** Sleutels van deze groep voor andere dagen weggooien. De speeldagen van
 *  vandáág blijven staan, ook als het er twee zijn (#1146). */
export function ruimOudeKeuzes(groupId: string, dag: string): void {
  const begin = `${PREFIX}${groupId}${MIDDEN}`;
  // Alles wat met deze dag begint blijft: `<dag>` zelf en `<dag>@<moment>`.
  const houdenBegin = `${begin}${dag}`;
  // Via length/key() en niet Object.keys(): dat laatste leest de eigenschappen
  // van het storage-object zelf, niet de opgeslagen sleutels — bij een shim
  // (jsdom, private mode) krijg je dan "getItem", "setItem", … terug.
  const sleutels: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const s = localStorage.key(i);
      if (s !== null) sleutels.push(s);
    }
  } catch {
    return; // geen storage (private mode) — niets op te ruimen
  }
  for (const sleutel of sleutels) {
    if (sleutel.startsWith(begin) && !sleutel.startsWith(houdenBegin)) {
      writeFlag(sleutel, null);
    }
  }
}

/**
 * De uiteindelijke selectie: de basis uit de poll, met de handmatige keuzes
 * eroverheen. Alleen huidige leden tellen mee — een keuze over iemand die de
 * groep verliet mag geen speler terugtoveren.
 */
export function pasKeuzesToe(
  leden: readonly string[],
  basis: readonly string[],
  keuzes: AanwezigKeuzes,
): Set<string> {
  const ledenSet = new Set(leden);
  const uit = new Set(basis.filter((id) => ledenSet.has(id)));
  for (const id of leden) {
    const keuze = keuzes[id];
    if (keuze === true) uit.add(id);
    else if (keuze === false) uit.delete(id);
  }
  return uit;
}
